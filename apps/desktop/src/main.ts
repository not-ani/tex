import * as Path from "node:path";

import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { APP_NAME, type AppInfo, type ThemePreference } from "@tex/contracts";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL?.trim() || "http://127.0.0.1:5173";
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

function resolveTheme(theme: unknown): ThemePreference {
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
}

async function loadRenderer(window: BrowserWindow) {
  if (isDevelopment) {
    await window.loadURL(DEV_SERVER_URL);
    return;
  }

  const indexPath = Path.resolve(__dirname, "../../web/dist/index.html");
  await window.loadFile(indexPath);
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

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
