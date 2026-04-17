import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST?.trim() || "127.0.0.1";
const configuredDevUrl = process.env.VITE_DEV_SERVER_URL?.trim() || "";

export default defineConfig({
  plugins: [
    react(),
    babel({
      parserOpts: { plugins: ["typescript", "jsx"] },
      presets: [reactCompilerPreset()]
    }),
    tailwindcss()
  ],
  define: {
    "import.meta.env.APP_VERSION": JSON.stringify(pkg.version),
    "import.meta.env.VITE_DEV_SERVER_URL": JSON.stringify(configuredDevUrl)
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    host,
    port,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  }
});
