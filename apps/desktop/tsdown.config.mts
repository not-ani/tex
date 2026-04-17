import { defineConfig } from "tsdown";

const shared = {
  format: "cjs" as const,
  outDir: "dist-electron",
  sourcemap: true,
  outExtensions: () => ({ js: ".js" })
};

export default defineConfig([
  {
    ...shared,
    entry: ["src/main.ts"],
    clean: true,
    noExternal: (id) => id.startsWith("@tex/"),
    // The desktop main process intentionally bundles runtime deps pulled in via
    // @tex/session-node, so CI should not fail on tsdown's node_modules warning.
    inlineOnly: false
  },
  {
    ...shared,
    entry: ["src/preload.ts"]
  }
]);
