# TeX Notary

TeX Notary is a local-first LaTeX workspace inspired by Overleaf for single-user desktop/localhost usage.

It provides:
- Unlimited local projects.
- Monaco-based `.tex` editing with snippets and outline navigation.
- Snapshot timeline with restore.
- PDF compilation and download.
- Auto Markdown preview (Pandoc-backed) for fast responsive reading.
- Electron packaging for macOS, Windows, and Linux.

## Monorepo Layout

- `apps/api` - Express + TypeScript backend and SQLite persistence.
- `apps/web` - React + Vite + Tailwind/shadcn-style UI.
- `apps/desktop` - Electron shell, packaging, and bundled binaries.
- `packages/shared` - shared type contracts.
- `.data` - runtime SQLite DB, temp files, and generated PDFs.

## Quick Start (Web)

Prerequisites:
- Node.js 22+
- npm 10+
- Pandoc installed locally (`pandoc --version`)
- Optional for PDF compile fallback: Docker daemon

Install and run:

```bash
npm install
npm run dev:api
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173).

## Quick Start (Desktop)

```bash
npm install
npm run prepare:tools
npm run dev:web
npm run dev:desktop
```

Build installers:

```bash
npm run dist:desktop
```

## Common Troubleshooting

- `better-sqlite3` ABI mismatch (`NODE_MODULE_VERSION` errors):

```bash
npm run fix:native
```

- If the packaged Electron app shows a `better-sqlite3` Node module version mismatch:

```bash
npm run rebuild:native -w @overleaf-lite/desktop
npm run dist:desktop
```

This repo uses one hoisted `better-sqlite3` binary for both API (Node) and desktop (Electron), so ABI can switch during different workflows. Desktop scripts now force Electron ABI before packaging.

- Compiler unavailable:
  - For desktop builds, run `npm run prepare:tectonic` (or `npm run prepare:tools`) and rebuild.
  - For web/API mode, install one local compiler (`tectonic`, `latexmk`, or `pdflatex`) or run Docker.
  - Check health endpoint: `GET /api/health`.

## Internal Documentation

- Architecture and flow: [`docs/internal/architecture.md`](docs/internal/architecture.md)
- Codebase map: [`docs/internal/codebase.md`](docs/internal/codebase.md)
- API contracts: [`docs/internal/api.md`](docs/internal/api.md)
- Database schema and persistence: [`docs/internal/database.md`](docs/internal/database.md)
- Dependencies, runtime/build loading: [`docs/internal/dependencies-runtime.md`](docs/internal/dependencies-runtime.md)
- Build, release, and CI/CD: [`docs/internal/build-release.md`](docs/internal/build-release.md)

## License

No license file is currently defined in this repository.
