# API Reference

Base URL in local web mode: `http://localhost:4000`

All JSON endpoints are under `/api/*`.

## Health

### `GET /api/health`

Response (example):

```json
{
  "ok": true,
  "dockerReady": false,
  "pandocReady": true,
  "compileReady": true,
  "compileBackend": "local",
  "backendPreference": "auto",
  "localCompiler": "tectonic",
  "dockerImage": "blang/latex:ctanfull"
}
```

## Projects

### `GET /api/projects`

Response:

```json
{
  "projects": [
    {
      "id": "uuid",
      "title": "Vatsal Resume",
      "updatedAt": "2026-02-22T10:18:00.000Z",
      "lastCompileStatus": "success"
    }
  ]
}
```

### `POST /api/projects`

Body:

```json
{
  "title": "Optional title",
  "content": "Optional LaTeX content"
}
```

- If omitted, title and default doc content are auto-generated.
- Creates initial `init` snapshot.

Response: `{ "project": Project }`

### `GET /api/projects/:projectId`

Response:

```json
{
  "id": "uuid",
  "title": "Name",
  "content": "...tex...",
  "updatedAt": "ISO timestamp"
}
```

### `PUT /api/projects/:projectId`

Body:

```json
{
  "title": "Optional",
  "content": "Optional",
  "snapshotReason": "manual_save"
}
```

- `snapshotReason` accepted values: `manual_save | autosave`.
- If both `snapshotReason` and `content` are provided, a version is created.

Response: `{ "project": Project }`

## Outline

### `GET /api/projects/:projectId/outline`

Response:

```json
{
  "items": [
    { "level": 1, "title": "Education", "line": 50 }
  ]
}
```

## Markdown Preview

### `POST /api/projects/:projectId/preview/markdown`

Body:

```json
{
  "content": "optional override tex"
}
```

Response:

```json
{
  "markdown": "...",
  "warnings": []
}
```

Errors:
- `500` if pandoc invocation fails.

## Compile

### `POST /api/projects/:projectId/compile`

Body:

```json
{
  "createSnapshot": true
}
```

Response:

```json
{
  "compileId": "uuid",
  "status": "success",
  "pdfAvailable": true,
  "errors": [],
  "warnings": [],
  "durationMs": 985
}
```

Notes:
- When `createSnapshot` is true (default), a new `compile` version is created first.
- Compile output metadata is persisted to `versions` and `compile_runs`.

## PDF Endpoints

### `GET /api/projects/:projectId/pdf/latest`

- Returns PDF binary for latest successful compile.
- `404` if no successful compile is available.

### `GET /api/projects/:projectId/versions/:versionId/download`

- Returns PDF binary for a specific version if stored.
- `404` if missing.

## Versions

### `GET /api/projects/:projectId/versions`

Response:

```json
{
  "versions": [
    {
      "id": "uuid",
      "createdAt": "ISO timestamp",
      "label": "Compile Snapshot",
      "compileStatus": "success"
    }
  ]
}
```

### `POST /api/projects/:projectId/versions/:versionId/restore`

- Restores project content from selected snapshot.
- Also creates a new `restore` snapshot.

Response:

```json
{
  "restored": {
    "id": "uuid",
    "projectId": "uuid",
    "content": "...",
    "label": "Restore 1234abcd",
    "reason": "restore",
    "compileStatus": null,
    "createdAt": "ISO timestamp"
  }
}
```

## Error Shape

Most route-level failures return:

```json
{ "error": "message" }
```

Validation failures from Zod return flattened issue structures under `error`.
