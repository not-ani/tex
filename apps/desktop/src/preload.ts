import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, ThemePreference } from "@tex/contracts";

const desktopBridge: DesktopBridge = {
  isDesktop: () => true,
  getAppInfo: () => ipcRenderer.invoke("desktop:get-app-info"),
  setTheme: (theme: ThemePreference) => ipcRenderer.invoke("desktop:set-theme", theme),
  openExternal: (url: string) => ipcRenderer.invoke("desktop:open-external", url),
  getUpdateState: () => ipcRenderer.invoke("desktop:update-get-state"),
  setUpdateChannel: (channel) => ipcRenderer.invoke("desktop:update-set-channel", channel),
  checkForUpdate: () => ipcRenderer.invoke("desktop:update-check"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:update-download"),
  installUpdate: () => ipcRenderer.invoke("desktop:update-install"),
  onUpdateState: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      if (typeof state !== "object" || state === null) return;
      listener(state as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on("desktop:update-state", wrappedListener);
    return () => {
      ipcRenderer.removeListener("desktop:update-state", wrappedListener);
    };
  },
  pickOpenDocument: () => ipcRenderer.invoke("desktop:pick-open-document"),
  pickCreateDocument: (defaultName?: string) =>
    ipcRenderer.invoke("desktop:pick-create-document", defaultName),
  openSessionFromFile: (filePath: string) =>
    ipcRenderer.invoke("desktop:open-session-from-file", filePath),
  createSessionAtPath: (filePath: string) =>
    ipcRenderer.invoke("desktop:create-session-at-path", filePath),
  updateSession: (args) => ipcRenderer.invoke("desktop:update-session", args),
  saveSession: (sessionId: string) => ipcRenderer.invoke("desktop:save-session", sessionId)
};

contextBridge.exposeInMainWorld("texDesktop", desktopBridge);
