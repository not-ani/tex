# Tex

Tex is a desktop-first writing workspace for debate prep, speech drafting, and structured rebuttal work.

This repo is a Bun + Turbo monorepo with a React/Vite frontend, an Electron desktop shell, and shared TypeScript packages for editor logic, desktop contracts, and DOCX/session handling.

## Getting Started

```sh
bun install
bun run dev
```

Useful commands:

```sh
bun run dev:web
bun run dev:desktop
bun run build
bun run start
bun run typecheck
bun run lint
bun run test
```

## Repo Structure

```text
.
├── apps/
│   ├── desktop/   # Electron main/preload process and desktop-only wiring
│   └── web/       # React + Vite renderer UI
├── packages/
│   ├── contracts/     # Shared desktop bridge types and app metadata
│   ├── editor/        # Core editor schema, document model, and formatting logic
│   └── session-node/  # Node-side DOCX open/save and session persistence
├── refs/          # Local reference repos / prior shapes used for comparison
├── package.json   # Root workspace scripts
├── turbo.json     # Monorepo task pipeline
└── tsconfig.base.json
```

## What Each Part Does

### `apps/web`

The renderer app. This is where the writing UI lives.

- `src/App.tsx`: top-level editor screen, autosave flow, open/create/save actions
- `src/features/editor/components/`: React components for the editor surface
- `src/features/editor/lib/`: client-side editor helpers like selection, zoom, shortcuts, and interactions
- `src/components/ui/`: shared UI primitives used by the app

In development, this runs as a normal Vite app. In desktop mode, Electron loads this same UI.

### `apps/desktop`

The Electron shell that turns the web UI into a desktop app.

- `src/main.ts`: creates the window, loads the renderer, and registers IPC handlers
- `src/preload.ts`: exposes the safe `window.texDesktop` bridge to the renderer
- `scripts/`: startup helpers for dev mode and production launching

This app owns native file dialogs, desktop lifecycle, and the session service used for local document editing.

### `packages/editor`

The shared editor engine used by both the renderer and the desktop bridge types.

- `src/types/document.ts`: document/session types
- `src/prosemirror/base-schema.ts`: ProseMirror schema
- `src/prosemirror/convert.ts`: conversion between ProseMirror documents and Tex block data
- `src/prosemirror/formatting.ts`: formatting commands like headings, underline, highlight, and cite styles
- `src/prosemirror/state.ts`: editor state helpers

If you are changing how documents are represented or edited, this package is usually the starting point.

### `packages/contracts`

The shared contract between the Electron preload layer and the renderer.

- app metadata constants
- desktop bridge interface
- shared types for opening, updating, and saving sessions

If `apps/web` calls something on `window.texDesktop`, the corresponding types should be defined here.

### `packages/session-node`

The Node-only document/session layer used by the desktop app.

- `src/docx/open.ts`: reads `.docx` files into Tex data
- `src/docx/save.ts`: writes Tex data back to `.docx`
- `src/session/service.ts`: manages in-memory editing sessions and versioned updates
- `src/session/repository.ts`: session persistence helpers

This package is what makes desktop document open/save work.

### `refs`

Reference material checked into the repo for comparison and scaffolding ideas. These are not the main app codepaths.

## How The Pieces Fit Together

1. `apps/web` renders the editor UI.
2. `apps/desktop` opens that UI inside Electron.
3. `apps/desktop/src/preload.ts` exposes `window.texDesktop`.
4. `packages/contracts` keeps that bridge typed.
5. `packages/session-node` handles local session state and DOCX I/O.
6. `packages/editor` provides the shared document model and editing behavior.

In dev mode, Electron points at the Vite dev server. In production, it loads the built `apps/web/dist` bundle.
