import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CompileStatus,
  Project,
  ProjectListItem,
  SnapshotReason,
  VersionSnapshot
} from "@overleaf-lite/shared";
import type { ProjectRecord, VersionRecord } from "../types.js";

const now = () => new Date().toISOString();

export class AppDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        current_content TEXT NOT NULL,
        last_compile_status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        content TEXT NOT NULL,
        label TEXT,
        reason TEXT NOT NULL,
        compile_status TEXT,
        compile_log TEXT,
        pdf_rel_path TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS compile_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        error_count INTEGER NOT NULL,
        warning_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(version_id) REFERENCES versions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_versions_project_created ON versions(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_compile_runs_project_created ON compile_runs(project_id, created_at DESC);
    `);
  }

  close() {
    this.db.close();
  }

  listProjects(): ProjectListItem[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, updated_at, last_compile_status
         FROM projects
         ORDER BY datetime(updated_at) DESC`
      )
      .all() as Array<Pick<ProjectRecord, "id" | "title" | "updated_at" | "last_compile_status">>;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
      lastCompileStatus: row.last_compile_status
    }));
  }

  createProject(title: string, content: string): Project {
    const id = randomUUID();
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO projects (id, title, current_content, last_compile_status, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?)`
      )
      .run(id, title, content, timestamp, timestamp);

    this.createVersion({
      projectId: id,
      content,
      reason: "init",
      label: "Initial"
    });

    return {
      id,
      title,
      currentContent: content,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastCompileStatus: null
    };
  }

  getProject(id: string): Project | null {
    const row = this.db
      .prepare(
        `SELECT id, title, current_content, created_at, updated_at, last_compile_status
         FROM projects WHERE id = ?`
      )
      .get(id) as ProjectRecord | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      currentContent: row.current_content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastCompileStatus: row.last_compile_status
    };
  }

  updateProject(input: {
    projectId: string;
    title?: string;
    content?: string;
    touchOnly?: boolean;
  }): Project | null {
    const existing = this.getProject(input.projectId);
    if (!existing) {
      return null;
    }

    const title = input.title ?? existing.title;
    const content = input.content ?? existing.currentContent;
    const timestamp = now();

    this.db
      .prepare(
        `UPDATE projects
         SET title = ?, current_content = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(title, content, timestamp, input.projectId);

    return this.getProject(input.projectId);
  }

  setProjectCompileStatus(projectId: string, status: CompileStatus) {
    const timestamp = now();
    this.db
      .prepare(`UPDATE projects SET last_compile_status = ?, updated_at = ? WHERE id = ?`)
      .run(status, timestamp, projectId);
  }

  createVersion(input: {
    projectId: string;
    content: string;
    reason: SnapshotReason;
    label?: string | null;
  }): VersionSnapshot {
    const id = randomUUID();
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO versions (id, project_id, content, label, reason, compile_status, compile_log, pdf_rel_path, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`
      )
      .run(id, input.projectId, input.content, input.label ?? null, input.reason, timestamp);

    return {
      id,
      projectId: input.projectId,
      content: input.content,
      label: input.label ?? null,
      reason: input.reason,
      compileStatus: null,
      createdAt: timestamp
    };
  }

  listVersions(projectId: string): VersionSnapshot[] {
    const rows = this.db
      .prepare(
        `SELECT id, project_id, content, label, reason, compile_status, created_at
         FROM versions
         WHERE project_id = ?
         ORDER BY datetime(created_at) DESC`
      )
      .all(projectId) as Array<
      Pick<
        VersionRecord,
        "id" | "project_id" | "content" | "label" | "reason" | "compile_status" | "created_at"
      >
    >;

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      content: row.content,
      label: row.label,
      reason: row.reason,
      compileStatus: row.compile_status,
      createdAt: row.created_at
    }));
  }

  getVersion(projectId: string, versionId: string): VersionRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, project_id, content, label, reason, compile_status, compile_log, pdf_rel_path, created_at
         FROM versions
         WHERE id = ? AND project_id = ?`
      )
      .get(versionId, projectId) as VersionRecord | undefined;

    return row ?? null;
  }

  setVersionCompileResult(input: {
    versionId: string;
    compileStatus: CompileStatus;
    compileLog: string;
    pdfRelPath?: string;
  }) {
    this.db
      .prepare(
        `UPDATE versions
         SET compile_status = ?, compile_log = ?, pdf_rel_path = ?
         WHERE id = ?`
      )
      .run(input.compileStatus, input.compileLog, input.pdfRelPath ?? null, input.versionId);
  }

  insertCompileRun(input: {
    id: string;
    projectId: string;
    versionId: string;
    status: CompileStatus;
    durationMs: number;
    errorCount: number;
    warningCount: number;
  }) {
    this.db
      .prepare(
        `INSERT INTO compile_runs (id, project_id, version_id, status, duration_ms, error_count, warning_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.projectId,
        input.versionId,
        input.status,
        input.durationMs,
        input.errorCount,
        input.warningCount,
        now()
      );
  }

  getLatestSuccessfulPdf(projectId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT pdf_rel_path
         FROM versions
         WHERE project_id = ? AND compile_status = 'success' AND pdf_rel_path IS NOT NULL
         ORDER BY datetime(created_at) DESC
         LIMIT 1`
      )
      .get(projectId) as { pdf_rel_path: string } | undefined;

    return row?.pdf_rel_path ?? null;
  }
}
