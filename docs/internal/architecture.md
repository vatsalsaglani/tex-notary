# Internal Architecture

## High-Level Design

TeX Notary is a local-first monorepo with three runtime surfaces:

1. Web app (`apps/web`) for editing and preview UX.
2. API (`apps/api`) for persistence, compilation, and conversion.
3. Desktop shell (`apps/desktop`) that embeds the API and web bundle.

## Runtime Topology

```mermaid
flowchart LR
  UI[React Web UI\napps/web] -->|HTTP JSON| API[Express API\napps/api]
  API -->|SQL| DB[(SQLite\n.data/app.sqlite)]
  API -->|spawn pandoc| PANDOC[Pandoc Binary]
  API -->|spawn local compiler\nor docker| TEX[TeX Compile Backend]
  API -->|read/write PDFs| PDFS[.data/pdfs]

  subgraph Desktop[Electron Mode]
    MAIN[Electron Main\napps/desktop/src/main.mjs] --> API
    MAIN --> WEBBUNDLE[Bundled Web Dist]
    MAIN --> RES[resources/bin/pandoc]
  end
```

## Request Flow (Typical)

### Edit + Markdown Preview

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web App
  participant A as API
  participant P as Pandoc

  U->>W: Type in Monaco editor
  W->>A: POST /api/projects/:id/preview/markdown (debounced)
  A->>P: spawn pandoc --from=latex --to=gfm+hard_line_breaks
  P-->>A: Markdown + stderr warnings
  A-->>W: { markdown, warnings }
  W-->>U: Rendered Markdown preview
```

### Compile + PDF Preview

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web App
  participant A as API
  participant C as Local Compiler or Docker
  participant F as File Storage

  U->>W: Click Compile PDF
  W->>A: POST /api/projects/:id/compile
  A->>A: Create/choose version snapshot
  A->>C: compile main.tex
  C-->>A: log + main.pdf
  A->>F: Save .data/pdfs/<projectId>/<versionId>.pdf
  A->>A: Persist compile metadata
  A-->>W: compile result JSON
  W->>A: GET /api/projects/:id/pdf/latest
  A-->>W: PDF binary
```

## Compile Backend Selection

Compile backend is resolved in `apps/api/src/services/compile.ts`:

- Preference from `LATEX_COMPILE_BACKEND`: `auto | local | docker`.
- Local compiler detection order: `tectonic` -> `latexmk` -> `pdflatex`.
- `auto` prefers local compiler, falls back to Docker if available.

## Data Locations

- SQLite DB: `.data/app.sqlite`
- Compile temp dirs: `.data/tmp/*`
- PDFs: `.data/pdfs/<projectId>/<versionId>.pdf`

`DATA_ROOT` env var can override `.data` location.
