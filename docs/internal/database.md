# Database and Persistence

Storage engine: SQLite via `better-sqlite3`.

Default DB path: `.data/app.sqlite` (override with `DATA_ROOT`).

## Schema

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` | PK (UUID) |
| `title` | `TEXT` | required |
| `current_content` | `TEXT` | current `.tex` source |
| `last_compile_status` | `TEXT` | nullable, `success` or `error` |
| `created_at` | `TEXT` | ISO timestamp |
| `updated_at` | `TEXT` | ISO timestamp |

### `versions`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` | PK (UUID) |
| `project_id` | `TEXT` | FK -> `projects.id` |
| `content` | `TEXT` | full snapshot content |
| `label` | `TEXT` | nullable display label |
| `reason` | `TEXT` | `init|manual_save|autosave|compile|restore` |
| `compile_status` | `TEXT` | nullable compile result |
| `compile_log` | `TEXT` | nullable compiler output |
| `pdf_rel_path` | `TEXT` | nullable relative path under data root |
| `created_at` | `TEXT` | ISO timestamp |

### `compile_runs`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` | PK (UUID) |
| `project_id` | `TEXT` | FK -> `projects.id` |
| `version_id` | `TEXT` | FK -> `versions.id` |
| `status` | `TEXT` | `success` or `error` |
| `duration_ms` | `INTEGER` | compile duration |
| `error_count` | `INTEGER` | parsed errors |
| `warning_count` | `INTEGER` | parsed warnings |
| `created_at` | `TEXT` | ISO timestamp |

Indexes:
- `idx_versions_project_created`
- `idx_compile_runs_project_created`

## Filesystem Persistence

- PDFs: `.data/pdfs/<projectId>/<versionId>.pdf`
- Temp compile workspace: `.data/tmp/<jobId>/`

## Data Lifecycle

1. Project created -> row in `projects` + `init` snapshot in `versions`.
2. Save/update -> `projects.current_content` updated.
3. Snapshot save/compile/restore -> new row in `versions`.
4. Compile run -> PDF saved (on success), compile metadata stored in both `versions` and `compile_runs`.
