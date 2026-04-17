# Tex Desktop Base

This workspace mirrors the desktop-first shape from the local `refs/t3code` reference, but stripped down to the minimum needed for Tex:

- `apps/web`: Vite + React 19 + TypeScript frontend
- `apps/desktop`: Electron shell bundled with `tsdown`
- `packages/contracts`: shared app metadata and preload bridge types

## Commands

```sh
bun install
bun run dev
```

Useful variants:

```sh
bun run dev:web
bun run build
bun run start
bun run typecheck
```

## Structure

The frontend stays a normal React app during development and build. The desktop app loads the Vite server in dev mode and the compiled `apps/web/dist` bundle in production mode. Shared types for the Electron preload bridge live in `packages/contracts` so the shell and frontend stay aligned as the app grows.
