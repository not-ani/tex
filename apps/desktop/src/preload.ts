import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, ThemePreference } from "@tex/contracts";

const desktopBridge: DesktopBridge = {
  isDesktop: () => true,
  getAppInfo: () => ipcRenderer.invoke("desktop:get-app-info"),
  setTheme: (theme: ThemePreference) => ipcRenderer.invoke("desktop:set-theme", theme),
  openExternal: (url: string) => ipcRenderer.invoke("desktop:open-external", url)
};

contextBridge.exposeInMainWorld("texDesktop", desktopBridge);
