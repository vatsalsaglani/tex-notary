# Dependencies and Runtime/Build Loading

## Package Responsibilities

### API (`apps/api/package.json`)

Runtime deps:
- `express`, `cors`: HTTP API stack.
- `better-sqlite3`: synchronous SQLite client.
- `zod`: request validation.
- `@overleaf-lite/shared`: shared type contracts.

Build/dev deps:
- `typescript`, `tsx`, `vitest`, `supertest`, `@types/*`.

### Web (`apps/web/package.json`)

Runtime deps:
- `react`, `react-dom`: UI runtime.
- `@monaco-editor/react`: code editor integration.
- `react-markdown`, `remark-gfm`, `rehype-raw`: Markdown rendering pipeline.
- `react-resizable-panels`: resizable pane UX.
- `lucide-react`, `framer-motion`: icons and animation.
- `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`: shadcn-style component primitives.
- `@overleaf-lite/shared`: shared types.

Build/dev deps:
- `vite`, `@vitejs/plugin-react`, `typescript`.
- `tailwindcss`, `postcss`, `autoprefixer`.

### Desktop (`apps/desktop/package.json`)

Runtime deps:
- `express`, `cors`, `better-sqlite3`, `zod` are included for packaged app runtime dependencies.

Build/dev deps:
- `electron`, `electron-builder`, `cross-env`, `app-builder-bin`.

## Runtime Loading Model

```mermaid
flowchart TD
  START[Process Start] --> APIBOOT[API createApp()]
  APIBOOT --> SQLITE[Load better-sqlite3 native module]
  APIBOOT --> PANDOC[Resolve pandoc binary candidate]
  APIBOOT --> COMP[Detect compile backend]

  subgraph Pandoc Resolution
    P1[env PANDOC_BIN]
    P2[Electron resourcesPath/bin/pandoc]
    P3[repo apps/desktop/resources/bin/pandoc]
    P4[system pandoc on PATH]
  end

  subgraph Tectonic Resolution
    T1[env LATEX_TECTONIC_BIN]
    T2[Electron resourcesPath/bin/tectonic]
    T3[repo apps/desktop/resources/bin/tectonic]
    T4[system tectonic on PATH]
  end

  PANDOC --> P1 --> P2 --> P3 --> P4
  COMP --> T1 --> T2 --> T3 --> T4
```

Pandoc resolution happens in `apps/api/src/services/markdown.ts`.
Tectonic resolution happens in `apps/api/src/services/compile.ts`.

## Build-Time vs Runtime

### Build-Time

- TypeScript compiles API and web source to `dist`.
- Vite bundles web assets.
- Electron `prepare-bundle.mjs` copies web+api dist into `apps/desktop/bundle`.
- `fetch-pandoc.mjs` downloads OS-specific pandoc executable into `apps/desktop/resources/bin`.
- `fetch-tectonic.mjs` downloads OS-specific tectonic executable into `apps/desktop/resources/bin`.

### Runtime (Web Mode)

- API runs from `apps/api/src/server.ts` (tsx watch) or `apps/api/dist/server.js`.
- Web app fetches API via `VITE_API_BASE_URL` or relative same-origin base.
- Pandoc expected from PATH unless `PANDOC_BIN` set.
- Tectonic expected from PATH unless `LATEX_TECTONIC_BIN` set.

### Runtime (Electron Mode)

- Electron main starts embedded API from bundled dist.
- API receives:
  - `DATA_ROOT` (inside app userData dir)
  - `PANDOC_BIN` (points to bundled binary in resources)
  - `LATEX_TECTONIC_BIN` (points to bundled binary in resources)
- Web renderer obtains API base from preload (`window.__OVERLEAF_API_BASE__`).

## Native Module Compatibility (`better-sqlite3`)

`better-sqlite3` is a native addon and tied to Node ABI.

Mitigation in repo:
- `apps/api/scripts/ensure-native.cjs` runs before dev/build/test/start in API workspace.
- It checks if addon loads; if not, rebuilds for current Node/npm.
- Root helper script: `npm run fix:native`.
