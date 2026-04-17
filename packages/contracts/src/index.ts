export const APP_NAME = "Tex";
export const APP_DESCRIPTION =
  "A desktop-first writing workspace for debate prep, speech drafting, and structured rebuttal work.";

export const DEFAULT_EDITOR_DOCUMENT = `Resolved: This workspace is the right starting point.

Observation one: the repo now matches the desktop-first stack from the T3 reference.
Observation two: the renderer is React running through Vite, not a web framework detour.
Observation three: Electron owns the shell so local files, shortcuts, and native flows can grow naturally.

Contention:
1. Use this document area as the drafting surface for speeches and blocks.
2. Grow the shared contracts package whenever the preload bridge or desktop APIs expand.
3. Keep the desktop and renderer coupled through types, not ad hoc strings.`;

export type ThemePreference = "system" | "light" | "dark";

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  channel: "browser" | "desktop";
}

export interface DesktopBridge {
  isDesktop(): boolean;
  getAppInfo(): Promise<AppInfo>;
  setTheme(theme: ThemePreference): Promise<void>;
  openExternal(url: string): Promise<void>;
}
