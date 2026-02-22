import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppDatabase } from "./db/database.js";
import { compileLatex, getCompileRuntimeInfo, isDockerReady } from "./services/compile.js";
import { convertLatexToMarkdown, isPandocReady, type MarkdownPreviewResult } from "./services/markdown.js";
import { resolveDataRoot } from "./utils/paths.js";
import { parseOutline } from "./utils/outline.js";
import type { CompileInput, CompileExecutionResult } from "./types.js";

const DEFAULT_DOC = String.raw`\documentclass{article}
\title{My Document}
\author{Local Overleaf Lite}
\begin{document}
\maketitle

\section{Introduction}
Write your LaTeX here.

\end{document}
`;

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().min(1).optional()
});

const updateProjectSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().min(1).optional(),
  snapshotReason: z.enum(["manual_save", "autosave"]).optional()
});

const compileSchema = z.object({
  createSnapshot: z.boolean().optional()
});

const markdownPreviewSchema = z.object({
  content: z.string().optional()
});

export interface AppOptions {
  dbPath?: string;
  compileFn?: (input: CompileInput) => Promise<CompileExecutionResult>;
  dockerReadyFn?: () => boolean;
  pandocReadyFn?: () => boolean;
  markdownPreviewFn?: (latex: string) => Promise<MarkdownPreviewResult>;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const dataRoot = resolveDataRoot();
  const dbPath = options.dbPath ?? path.join(dataRoot, "app.sqlite");
  const compileFn = options.compileFn ?? compileLatex;
  const dockerReadyFn = options.dockerReadyFn ?? isDockerReady;
  const pandocReadyFn = options.pandocReadyFn ?? isPandocReady;
  const markdownPreviewFn = options.markdownPreviewFn ?? convertLatexToMarkdown;
  const db = new AppDatabase(dbPath);

  const pdfRoots = [dataRoot, path.resolve(dataRoot, "..", ".data")];
  const resolvePdfPath = (storedPath: string) => {
    if (path.isAbsolute(storedPath)) {
      return fs.existsSync(storedPath) ? storedPath : null;
    }

    for (const root of pdfRoots) {
      const candidate = path.resolve(root, storedPath);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  };

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    const runtime = getCompileRuntimeInfo();
    res.json({
      ok: true,
      dockerReady: options.dockerReadyFn ? dockerReadyFn() : runtime.dockerReady,
      pandocReady: pandocReadyFn(),
      compileReady: runtime.compileReady,
      compileBackend: runtime.selectedBackend,
      backendPreference: runtime.backendPreference,
      localCompiler: runtime.localCompiler,
      dockerImage: runtime.dockerImage
    });
  });

  app.get("/api/projects", (_req, res) => {
    res.json({ projects: db.listProjects() });
  });

  app.post("/api/projects", (req, res) => {
    const parsed = createProjectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const title = parsed.data.title ?? `Project ${new Date().toLocaleString()}`;
    const content = parsed.data.content ?? DEFAULT_DOC;

    const project = db.createProject(title, content);
    return res.status(201).json({ project });
  });

  app.get("/api/projects/:projectId", (req, res) => {
    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.json({
      id: project.id,
      title: project.title,
      content: project.currentContent,
      updatedAt: project.updatedAt
    });
  });

  app.put("/api/projects/:projectId", (req, res) => {
    const parsed = updateProjectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const project = db.updateProject({
      projectId: req.params.projectId,
      title: parsed.data.title,
      content: parsed.data.content
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (parsed.data.snapshotReason && parsed.data.content) {
      db.createVersion({
        projectId: project.id,
        content: project.currentContent,
        reason: parsed.data.snapshotReason,
        label: parsed.data.snapshotReason === "manual_save" ? "Manual Save" : null
      });
    }

    return res.json({ project });
  });

  app.get("/api/projects/:projectId/outline", (req, res) => {
    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const items = parseOutline(project.currentContent);
    return res.json({ items });
  });

  app.post("/api/projects/:projectId/preview/markdown", async (req, res) => {
    const parsed = markdownPreviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    try {
      const source = parsed.data.content ?? project.currentContent;
      const result = await markdownPreviewFn(source);
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pandoc preview failed";
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/projects/:projectId/compile", async (req, res) => {
    const parsed = compileSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const createSnapshot = parsed.data.createSnapshot ?? true;
    const latest = db.listVersions(project.id)[0];
    const snapshot =
      createSnapshot || !latest
        ? db.createVersion({
            projectId: project.id,
            content: project.currentContent,
            reason: "compile",
            label: "Compile Snapshot"
          })
        : latest;

    const compileResult = await compileFn({
      projectId: project.id,
      versionId: snapshot.id,
      content: project.currentContent
    });

    const relativePdfPath = compileResult.pdfAbsPath
      ? path.relative(resolveDataRoot(), compileResult.pdfAbsPath)
      : undefined;

    db.setVersionCompileResult({
      versionId: snapshot.id,
      compileStatus: compileResult.status,
      compileLog: compileResult.log,
      pdfRelPath: relativePdfPath
    });

    db.setProjectCompileStatus(project.id, compileResult.status);

    const compileId = randomUUID();
    db.insertCompileRun({
      id: compileId,
      projectId: project.id,
      versionId: snapshot.id,
      status: compileResult.status,
      durationMs: compileResult.durationMs,
      errorCount: compileResult.errors.length,
      warningCount: compileResult.warnings.length
    });

    return res.json({
      compileId,
      status: compileResult.status,
      pdfAvailable: Boolean(compileResult.pdfAbsPath),
      errors: compileResult.errors,
      warnings: compileResult.warnings,
      durationMs: compileResult.durationMs
    });
  });

  app.get("/api/projects/:projectId/pdf/latest", (req, res) => {
    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const rel = db.getLatestSuccessfulPdf(project.id);
    if (!rel) {
      return res.status(404).json({ error: "No compiled PDF found" });
    }

    const absPath = resolvePdfPath(rel);
    if (!absPath) {
      return res.status(404).json({ error: "Compiled PDF path not found on disk" });
    }

    return res.sendFile(absPath, { dotfiles: "allow" }, (error) => {
      const sendError = error as (NodeJS.ErrnoException & { statusCode?: number }) | undefined;
      if (sendError && !res.headersSent) {
        return res.status(sendError.statusCode || 500).json({ error: "Failed to read compiled PDF" });
      }
      return undefined;
    });
  });

  app.get("/api/projects/:projectId/versions", (req, res) => {
    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const versions = db.listVersions(project.id).map((version) => ({
      id: version.id,
      createdAt: version.createdAt,
      label: version.label,
      compileStatus: version.compileStatus
    }));

    return res.json({ versions });
  });

  app.post("/api/projects/:projectId/versions/:versionId/restore", (req, res) => {
    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const version = db.getVersion(project.id, req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    db.updateProject({
      projectId: project.id,
      content: version.content
    });

    const restored = db.createVersion({
      projectId: project.id,
      content: version.content,
      reason: "restore",
      label: `Restore ${req.params.versionId.slice(0, 8)}`
    });

    return res.json({ restored });
  });

  app.get("/api/projects/:projectId/versions/:versionId/download", (req, res) => {
    const project = db.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const version = db.getVersion(project.id, req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    if (!version.pdf_rel_path) {
      return res.status(404).json({ error: "No PDF stored for this version" });
    }

    const abs = resolvePdfPath(version.pdf_rel_path);
    if (!abs) {
      return res.status(404).json({ error: "Version PDF path not found on disk" });
    }

    return res.sendFile(abs, { dotfiles: "allow" }, (error) => {
      const sendError = error as (NodeJS.ErrnoException & { statusCode?: number }) | undefined;
      if (sendError && !res.headersSent) {
        return res.status(sendError.statusCode || 500).json({ error: "Failed to read version PDF" });
      }
      return undefined;
    });
  });

  return app;
}
