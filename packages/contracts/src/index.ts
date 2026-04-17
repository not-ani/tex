import type {
  TexSessionOpenResult,
  TexSessionSnapshot,
  TexSessionUpdateArgs
} from "@tex/editor";

export const APP_NAME = "Tex";
export const APP_DESCRIPTION =
  "A desktop-first writing workspace for debate prep, speech drafting, and structured rebuttal work.";

export type ThemePreference = "system" | "light" | "dark";
export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";
export type DesktopRuntimeArch = "arm64" | "x64" | "other";
export type DesktopUpdateChannel = "latest" | "nightly";

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  channel: "browser" | "desktop";
}

export interface DesktopRuntimeInfo {
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
}

export interface DesktopUpdateState extends DesktopRuntimeInfo {
  enabled: boolean;
  status: DesktopUpdateStatus;
  channel: DesktopUpdateChannel;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}

export interface DesktopUpdateActionResult {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
}

export interface DesktopUpdateCheckResult {
  checked: boolean;
  state: DesktopUpdateState;
}

export interface DesktopBridge {
  isDesktop(): boolean;
  getAppInfo(): Promise<AppInfo>;
  setTheme(theme: ThemePreference): Promise<void>;
  openExternal(url: string): Promise<void>;
  getUpdateState(): Promise<DesktopUpdateState>;
  setUpdateChannel(channel: DesktopUpdateChannel): Promise<DesktopUpdateState>;
  checkForUpdate(): Promise<DesktopUpdateCheckResult>;
  downloadUpdate(): Promise<DesktopUpdateActionResult>;
  installUpdate(): Promise<DesktopUpdateActionResult>;
  onUpdateState(listener: (state: DesktopUpdateState) => void): () => void;
  pickOpenDocument(): Promise<string | null>;
  pickCreateDocument(defaultName?: string): Promise<string | null>;
  openSessionFromFile(filePath: string): Promise<TexSessionOpenResult>;
  createSessionAtPath(filePath: string): Promise<TexSessionOpenResult>;
  updateSession(args: TexSessionUpdateArgs): Promise<TexSessionSnapshot>;
  saveSession(sessionId: string): Promise<TexSessionSnapshot>;
}
