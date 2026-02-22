# Build, Packaging, and Release

## Local Build Commands

From repo root:

```bash
npm run build
npm run test
```

Desktop packaging:

```bash
npm run prepare:tools
npm run dist:desktop
```

Outputs:
- `apps/desktop/dist/*`

## Electron Packaging Details

Configuration lives in `apps/desktop/package.json` under `build`:

- `extraResources`: copies `apps/desktop/resources/bin/*` to packaged app resources.
- `asarUnpack`: keeps `better-sqlite3` unpacked for native loading.
- Targets:
  - macOS: `dmg`, `zip`
  - Windows: `nsis`, `zip`
  - Linux: `AppImage`, `deb`

## Bundled Binary Strategy

Currently bundled:
- Pandoc (`resources/bin/pandoc` or `pandoc.exe`)
- Tectonic (`resources/bin/tectonic` or `tectonic.exe`)

Compile backend remains runtime-selectable:
- Local compiler (`tectonic` / `latexmk` / `pdflatex`) preferred in `auto`.
- Docker fallback if local compiler unavailable and Docker daemon running.

## CI/CD Workflow

Workflow file: `.github/workflows/desktop-release.yml`

Triggers:
- `create` event (branch)
- `push` on branches:
  - `v*`
  - `version/v*`

Jobs:
1. `build` (matrix: macOS, Windows, Linux)
   - install deps
   - sync desktop package version from branch (`vX.Y.Z` -> `X.Y.Z`)
   - download pandoc + tectonic for runner OS
   - build desktop artifacts
   - upload artifacts
2. `release` (Ubuntu)
   - downloads artifacts
   - creates tag if missing
   - creates/updates GitHub release with artifacts

## Branch/Version Convention

- `v0.0.1` or `version/v0.0.1` -> release version `v0.0.1`
- Desktop package version becomes `0.0.1`

## Environment Variables

Compile/runtime flags (API):
- `LATEX_COMPILE_BACKEND=auto|local|docker`
- `LATEX_DOCKER_IMAGE=<image>`
- `PANDOC_BIN=<path to pandoc>`
- `LATEX_TECTONIC_BIN=<path to tectonic>`
- `DATA_ROOT=<path to .data root>`
- `PORT=<api port>`

Web:
- `VITE_API_BASE_URL=<absolute/relative API base>`

Desktop:
- `ELECTRON_DEV=1` for development flow in `apps/desktop` scripts.
