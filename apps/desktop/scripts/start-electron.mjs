import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const desktopRoot = fileURLToPath(new URL("../", import.meta.url));
const childEnv = { ...process.env };

delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  cwd: desktopRoot,
  stdio: "inherit",
  env: childEnv
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
