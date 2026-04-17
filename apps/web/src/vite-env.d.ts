/// <reference types="vite/client" />

import type { DesktopBridge } from "@tex/contracts";

interface ImportMetaEnv {
  readonly APP_VERSION: string;
  readonly VITE_DEV_SERVER_URL: string;
}

declare global {
  interface Window {
    texDesktop?: DesktopBridge;
  }
}

export {};
