import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { waitForUrl } from "./wait-for-url.mjs";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const desktopRoot = fileURLToPath(new URL("../", import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL?.trim() || "http://127.0.0.1:5173";
const childEnv = { ...process.env };

delete childEnv.ELECTRON_RUN_AS_NODE;

await waitForUrl(devServerUrl);

const child = spawn(electronBinary, ["."], {
  cwd: desktopRoot,
  stdio: "inherit",
  env: {
    ...childEnv,
    VITE_DEV_SERVER_URL: devServerUrl
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
