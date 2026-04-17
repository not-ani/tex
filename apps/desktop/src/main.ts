import * as FS from "node:fs";
import * as Path from "node:path";

import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { SessionService } from "@tex/session-node";
import {
  APP_NAME,
  type AppInfo,
  type DesktopUpdateActionResult,
  type DesktopUpdateChannel,
  type DesktopUpdateCheckResult,
  type DesktopUpdateState,
  type ThemePreference
} from "@tex/contracts";
import {
  readDesktopSettings,
  resolveDefaultDesktopSettings,
  setDesktopUpdateChannelPreference,
  writeDesktopSettings,
  type DesktopSettings
} from "./desktopSettings";
import { isArm64HostRunningIntelBuild, resolveDesktopRuntimeInfo } from "./runtimeArch";
import { doesVersionMatchDesktopUpdateChannel } from "./updateChannels";
import {
  createInitialDesktopUpdateState,
  reduceDesktopUpdateStateOnCheckFailure,
  reduceDesktopUpdateStateOnCheckStart,
  reduceDesktopUpdateStateOnDownloadComplete,
  reduceDesktopUpdateStateOnDownloadFailure,
  reduceDesktopUpdateStateOnDownloadProgress,
  reduceDesktopUpdateStateOnDownloadStart,
  reduceDesktopUpdateStateOnInstallFailure,
  reduceDesktopUpdateStateOnNoUpdate,
  reduceDesktopUpdateStateOnUpdateAvailable
} from "./updateMachine";
import {
  getAutoUpdateDisabledReason,
  shouldBroadcastDownloadProgress
} from "./updateState";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL?.trim() || "http://127.0.0.1:5173";
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const documentFilters = [{ name: "Word Documents", extensions: ["docx"] }];
const UPDATE_STATE_CHANNEL = "desktop:update-state";
const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_SET_CHANNEL_CHANNEL = "desktop:update-set-channel";
const UPDATE_CHECK_CHANNEL = "desktop:update-check";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";
const AUTO_UPDATE_STARTUP_DELAY_MS = 15_000;
const AUTO_UPDATE_POLL_INTERVAL_MS = 4 * 60 * 60 * 1000;

let mainWindow: BrowserWindow | null = null;
let sessionService: SessionService | null = null;
let desktopSettings: DesktopSettings = resolveDefaultDesktopSettings(app.getVersion());
const desktopRuntimeInfo = resolveDesktopRuntimeInfo({
  processArch: process.arch,
  runningUnderArm64Translation: app.runningUnderARM64Translation === true
});
let updateState: DesktopUpdateState = {
  ...createInitialDesktopUpdateState(app.getVersion(), desktopRuntimeInfo, desktopSettings.updateChannel),
  enabled: false,
  status: "disabled"
};
let updaterConfigured = false;
let updateCheckInFlight = false;
let updateDownloadInFlight = false;
let updateInstallInFlight = false;
let updateStartupTimer: ReturnType<typeof setTimeout> | null = null;
let updatePollTimer: ReturnType<typeof setInterval> | null = null;
let isQuittingForInstall = false;

function getSessionService() {
  if (!sessionService) {
    throw new Error("Session service is not ready.");
  }

  return sessionService;
}

function getDesktopSettingsPath() {
  return Path.join(app.getPath("userData"), "desktop-settings.json");
}

function resolveTheme(theme: unknown): ThemePreference {
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
}

function resolveRendererIndexPath() {
  const packagedRendererPath = Path.join(process.resourcesPath, "web-dist", "index.html");
  if (FS.existsSync(packagedRendererPath)) {
    return packagedRendererPath;
  }

  return Path.resolve(__dirname, "../../web/dist/index.html");
}

async function loadRenderer(window: BrowserWindow) {
  if (isDevelopment) {
    await window.loadURL(DEV_SERVER_URL);
    return;
  }

  await window.loadFile(resolveRendererIndexPath());
}

function emitUpdateState(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.webContents.send(UPDATE_STATE_CHANNEL, updateState);
  }
}

function setUpdateState(patch: Partial<DesktopUpdateState>): void {
  updateState = { ...updateState, ...patch };
  emitUpdateState();
}

function createBaseUpdateState(
  channel: DesktopUpdateChannel,
  enabled: boolean,
  message: string | null = null
): DesktopUpdateState {
  return {
    ...createInitialDesktopUpdateState(app.getVersion(), desktopRuntimeInfo, channel),
    enabled,
    status: enabled ? "idle" : "disabled",
    message
  };
}

function clearUpdatePollTimer() {
  if (updateStartupTimer) {
    clearTimeout(updateStartupTimer);
    updateStartupTimer = null;
  }
  if (updatePollTimer) {
    clearInterval(updatePollTimer);
    updatePollTimer = null;
  }
}

function applyAutoUpdaterChannel(channel: DesktopUpdateChannel): void {
  autoUpdater.channel = channel;
  autoUpdater.allowPrerelease = channel === "nightly";
  autoUpdater.allowDowngrade = channel === "nightly";
}

function readAppUpdateYml(): Record<string, string> | null {
  try {
    const ymlPath = app.isPackaged
      ? Path.join(process.resourcesPath, "app-update.yml")
      : Path.join(app.getAppPath(), "dev-app-update.yml");
    const raw = FS.readFileSync(ymlPath, "utf8");
    const entries: Record<string, string> = {};

    for (const line of raw.split("\n")) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match?.[1] && match[2]) {
        entries[match[1]] = match[2].trim();
      }
    }

    return entries.provider ? entries : null;
  } catch {
    return null;
  }
}

function shouldEnableAutoUpdates(): { enabled: boolean; reason: string | null } {
  const hasUpdateFeedConfig =
    readAppUpdateYml() !== null || Boolean(process.env.TEX_DESKTOP_MOCK_UPDATES);
  const reason = getAutoUpdateDisabledReason({
    isDevelopment,
    isPackaged: app.isPackaged,
    platform: process.platform,
    appImage: process.env.APPIMAGE,
    disabledByEnv: process.env.TEX_DISABLE_AUTO_UPDATE === "1",
    hasUpdateFeedConfig
  });

  return {
    enabled: reason === null,
    reason
  };
}

function resolveUpdaterErrorContext(): DesktopUpdateState["errorContext"] {
  if (updateInstallInFlight || updateState.status === "downloaded") {
    return "install";
  }
  if (updateDownloadInFlight || updateState.status === "downloading") {
    return "download";
  }
  return "check";
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function checkForUpdates(reason: string): Promise<boolean> {
  if (isQuittingForInstall || !updaterConfigured || updateCheckInFlight) return false;
  if (updateState.status === "downloading" || updateState.status === "downloaded") {
    return false;
  }

  updateCheckInFlight = true;
  setUpdateState(reduceDesktopUpdateStateOnCheckStart(updateState, new Date().toISOString()));

  try {
    await autoUpdater.checkForUpdates();
    return true;
  } catch (error: unknown) {
    setUpdateState(
      reduceDesktopUpdateStateOnCheckFailure(
        updateState,
        formatErrorMessage(error),
        new Date().toISOString()
      )
    );
    console.error(`[desktop-updater] Failed to check for updates (${reason}):`, error);
    return true;
  } finally {
    updateCheckInFlight = false;
  }
}

async function downloadAvailableUpdate(): Promise<{ accepted: boolean; completed: boolean }> {
  if (!updaterConfigured || updateDownloadInFlight || updateState.status !== "available") {
    return { accepted: false, completed: false };
  }

  updateDownloadInFlight = true;
  setUpdateState(reduceDesktopUpdateStateOnDownloadStart(updateState));
  autoUpdater.disableDifferentialDownload = isArm64HostRunningIntelBuild(desktopRuntimeInfo);

  try {
    await autoUpdater.downloadUpdate();
    return { accepted: true, completed: true };
  } catch (error: unknown) {
    setUpdateState(
      reduceDesktopUpdateStateOnDownloadFailure(updateState, formatErrorMessage(error))
    );
    console.error("[desktop-updater] Failed to download update:", error);
    return { accepted: true, completed: false };
  } finally {
    updateDownloadInFlight = false;
  }
}

async function installDownloadedUpdate(): Promise<{ accepted: boolean; completed: boolean }> {
  if (isQuittingForInstall || !updaterConfigured || updateState.status !== "downloaded") {
    return { accepted: false, completed: false };
  }

  isQuittingForInstall = true;
  updateInstallInFlight = true;
  clearUpdatePollTimer();

  try {
    for (const win of BrowserWindow.getAllWindows()) {
      win.destroy();
    }
    autoUpdater.quitAndInstall(true, true);
    return { accepted: true, completed: false };
  } catch (error: unknown) {
    updateInstallInFlight = false;
    isQuittingForInstall = false;
    setUpdateState(
      reduceDesktopUpdateStateOnInstallFailure(updateState, formatErrorMessage(error))
    );
    console.error("[desktop-updater] Failed to install update:", error);
    return { accepted: true, completed: false };
  }
}

function configureAutoUpdater(): void {
  const githubToken =
    process.env.TEX_DESKTOP_UPDATE_GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    "";

  if (githubToken) {
    const appUpdateYml = readAppUpdateYml();
    if (appUpdateYml?.provider === "github") {
      autoUpdater.setFeedURL({
        ...appUpdateYml,
        provider: "github",
        private: true,
        token: githubToken
      });
    }
  }

  if (process.env.TEX_DESKTOP_MOCK_UPDATES) {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: `http://localhost:${process.env.TEX_DESKTOP_MOCK_UPDATE_SERVER_PORT ?? 3000}`
    });
  }

  const availability = shouldEnableAutoUpdates();
  setUpdateState(
    createBaseUpdateState(desktopSettings.updateChannel, availability.enabled, availability.reason)
  );
  if (!availability.enabled) {
    updaterConfigured = false;
    return;
  }

  updaterConfigured = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  applyAutoUpdaterChannel(desktopSettings.updateChannel);
  autoUpdater.disableDifferentialDownload = isArm64HostRunningIntelBuild(desktopRuntimeInfo);

  autoUpdater.on("update-available", (info) => {
    if (!doesVersionMatchDesktopUpdateChannel(info.version, updateState.channel)) {
      setUpdateState(reduceDesktopUpdateStateOnNoUpdate(updateState, new Date().toISOString()));
      return;
    }

    setUpdateState(
      reduceDesktopUpdateStateOnUpdateAvailable(
        updateState,
        info.version,
        new Date().toISOString()
      )
    );
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState(reduceDesktopUpdateStateOnNoUpdate(updateState, new Date().toISOString()));
  });

  autoUpdater.on("download-progress", (progress) => {
    if (shouldBroadcastDownloadProgress(updateState, progress.percent)) {
      setUpdateState(reduceDesktopUpdateStateOnDownloadProgress(updateState, progress.percent));
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState(reduceDesktopUpdateStateOnDownloadComplete(updateState, info.version));
  });

  autoUpdater.on("error", (error) => {
    const message = formatErrorMessage(error);

    if (updateInstallInFlight) {
      updateInstallInFlight = false;
      isQuittingForInstall = false;
      setUpdateState(reduceDesktopUpdateStateOnInstallFailure(updateState, message));
      return;
    }

    if (!updateCheckInFlight && !updateDownloadInFlight) {
      setUpdateState({
        status: "error",
        message,
        checkedAt: new Date().toISOString(),
        downloadPercent: null,
        errorContext: resolveUpdaterErrorContext(),
        canRetry: updateState.availableVersion !== null || updateState.downloadedVersion !== null
      });
    }
  });

  clearUpdatePollTimer();
  updateStartupTimer = setTimeout(() => {
    updateStartupTimer = null;
    void checkForUpdates("startup");
  }, AUTO_UPDATE_STARTUP_DELAY_MS);
  updateStartupTimer.unref();

  updatePollTimer = setInterval(() => {
    void checkForUpdates("poll");
  }, AUTO_UPDATE_POLL_INTERVAL_MS);
  updatePollTimer.unref();
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1220,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#171312" : "#f4efe5",
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" as const } : {}),
    webPreferences: {
      contextIsolation: true,
      preload: Path.join(__dirname, "preload.js")
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await loadRenderer(window);
  mainWindow = window;

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

ipcMain.handle("desktop:get-app-info", (): AppInfo => ({
  name: APP_NAME,
  version: app.getVersion(),
  platform: process.platform,
  channel: "desktop"
}));

ipcMain.handle("desktop:set-theme", (_event, theme: unknown) => {
  nativeTheme.themeSource = resolveTheme(theme);
});

ipcMain.handle("desktop:open-external", async (_event, url: unknown) => {
  if (typeof url !== "string" || url.trim().length === 0) {
    return;
  }

  await shell.openExternal(url);
});

ipcMain.handle(UPDATE_GET_STATE_CHANNEL, async () => updateState);

ipcMain.handle(UPDATE_SET_CHANNEL_CHANNEL, async (_event, rawChannel: unknown) => {
  if (rawChannel !== "latest" && rawChannel !== "nightly") {
    throw new Error("Invalid desktop update channel input.");
  }
  if (updateCheckInFlight || updateDownloadInFlight || updateInstallInFlight) {
    throw new Error("Cannot change update tracks while an update action is in progress.");
  }

  const nextChannel = rawChannel as DesktopUpdateChannel;
  desktopSettings = setDesktopUpdateChannelPreference(desktopSettings, nextChannel);
  writeDesktopSettings(getDesktopSettingsPath(), desktopSettings);

  if (nextChannel === updateState.channel) {
    return updateState;
  }

  const availability = shouldEnableAutoUpdates();
  setUpdateState(
    createBaseUpdateState(nextChannel, availability.enabled, availability.reason)
  );

  if (!availability.enabled || !updaterConfigured) {
    return updateState;
  }

  applyAutoUpdaterChannel(nextChannel);
  const allowDowngrade = autoUpdater.allowDowngrade;
  autoUpdater.allowDowngrade = true;

  try {
    await checkForUpdates("channel-change");
  } finally {
    autoUpdater.allowDowngrade = allowDowngrade;
  }

  return updateState;
});

ipcMain.handle(UPDATE_CHECK_CHANNEL, async () => {
  if (!updaterConfigured) {
    return {
      checked: false,
      state: updateState
    } satisfies DesktopUpdateCheckResult;
  }

  const checked = await checkForUpdates("web-ui");
  return {
    checked,
    state: updateState
  } satisfies DesktopUpdateCheckResult;
});

ipcMain.handle(UPDATE_DOWNLOAD_CHANNEL, async () => {
  const result = await downloadAvailableUpdate();
  return {
    accepted: result.accepted,
    completed: result.completed,
    state: updateState
  } satisfies DesktopUpdateActionResult;
});

ipcMain.handle(UPDATE_INSTALL_CHANNEL, async () => {
  const result = await installDownloadedUpdate();
  return {
    accepted: result.accepted,
    completed: result.completed,
    state: updateState
  } satisfies DesktopUpdateActionResult;
});

ipcMain.handle("desktop:pick-open-document", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: documentFilters
  });

  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle("desktop:pick-create-document", async (_event, defaultName: unknown) => {
  const result = await dialog.showSaveDialog({
    defaultPath:
      typeof defaultName === "string" && defaultName.trim().length > 0
        ? defaultName
        : "speech.docx",
    filters: documentFilters
  });

  return result.canceled ? null : (result.filePath ?? null);
});

ipcMain.handle("desktop:open-session-from-file", async (_event, filePath: unknown) => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("A file path is required to open a document.");
  }

  return getSessionService().openSessionFromFile(filePath);
});

ipcMain.handle("desktop:create-session-at-path", async (_event, filePath: unknown) => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("A file path is required to create a document.");
  }

  return getSessionService().createSessionAtPath(filePath);
});

ipcMain.handle("desktop:update-session", async (_event, args: unknown) => {
  if (!args || typeof args !== "object") {
    throw new Error("Session update arguments are required.");
  }

  return getSessionService().updateSession(args as Parameters<SessionService["updateSession"]>[0]);
});

ipcMain.handle("desktop:save-session", async (_event, sessionId: unknown) => {
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    throw new Error("A session id is required to save a document.");
  }

  return getSessionService().saveSession(sessionId);
});

app.whenReady().then(async () => {
  desktopSettings = readDesktopSettings(getDesktopSettingsPath(), app.getVersion());
  sessionService = new SessionService(Path.join(app.getPath("userData"), "editor"));
  configureAutoUpdater();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  clearUpdatePollTimer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
