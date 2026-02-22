# Codebase Structure

## Repository Tree (Key Paths)

```text
tex-notary/
  apps/
    api/
      src/
        app.ts
        server.ts
        db/database.ts
        services/compile.ts
        services/markdown.ts
        utils/outline.ts
        utils/compile-log.ts
        utils/paths.ts
    web/
      src/
        App.tsx
        api.ts
        styles.css
        editor/latexMonaco.ts
        components/
          Toolbar.tsx
          ProjectList.tsx
          BottomDrawer.tsx
          PdfPreview.tsx
          ui/*
    desktop/
      src/
        main.mjs
        preload.cjs
      scripts/
        prepare-bundle.mjs
        fetch-pandoc.mjs
      resources/bin/
  packages/
    shared/src/index.ts
  .github/workflows/desktop-release.yml
```

## API Layer (`apps/api`)

- `src/server.ts`: process entrypoint; starts Express app.
- `src/app.ts`: all HTTP routes and orchestration.
- `src/db/database.ts`: SQLite schema init and query methods.
- `src/services/compile.ts`: TeX compile pipeline and backend selection.
- `src/services/markdown.ts`: Pandoc conversion pipeline.
- `src/utils/outline.ts`: outline parsing from LaTeX headings.
- `src/utils/compile-log.ts`: parse compile warnings/errors with optional line/column hints.
- `scripts/ensure-native.cjs`: rebuilds native deps (better-sqlite3) for current Node ABI.

## Web Layer (`apps/web`)

- `src/App.tsx`: app shell, panel layout, editor + preview + state management.
- `src/api.ts`: all fetch client calls to backend.
- `src/components/`:
  - `Toolbar.tsx`: save/snapshot/compile controls.
  - `ProjectList.tsx`: project sidebar and create/select interactions.
  - `BottomDrawer.tsx`: outline/errors/versions tabs.
  - `PdfPreview.tsx`: Markdown/PDF preview tabs and render logic.
- `src/editor/latexMonaco.ts`: Monaco LaTeX language/theme configuration.
- `src/styles.css`: Tailwind base + custom theme tokens/typography styles.

## Desktop Layer (`apps/desktop`)

- `src/main.mjs`: Electron main process; boots embedded API and BrowserWindow.
- `src/preload.cjs`: exposes API base URL to renderer via `window.__OVERLEAF_API_BASE__`.
- `scripts/prepare-bundle.mjs`: copies API and web build outputs for desktop packaging.
- `scripts/fetch-pandoc.mjs`: downloads per-OS Pandoc binary into `resources/bin`.

## Shared Types (`packages/shared`)

`packages/shared/src/index.ts` defines shared compile/project/version/outline contracts used by both API and web client.
