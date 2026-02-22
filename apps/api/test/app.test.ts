import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const tempFiles: string[] = [];

afterEach(() => {
  for (const file of tempFiles) {
    for (const candidate of [file, `${file}-wal`, `${file}-shm`]) {
      if (fs.existsSync(candidate)) {
        fs.rmSync(candidate, { force: true, recursive: true });
      }
    }
  }
});

describe("api integration", () => {
  it("creates project, compiles, snapshots, and restores", async () => {
    const dbPath = path.join(process.cwd(), `.tmp-${randomUUID()}.sqlite`);
    tempFiles.push(dbPath);

    const app = createApp({
      dbPath,
      dockerReadyFn: () => true,
      compileFn: async () => ({
        status: "success",
        errors: [],
        warnings: [],
        durationMs: 100,
        log: "ok"
      })
    });

    const createRes = await request(app)
      .post("/api/projects")
      .send({ title: "Test", content: "\\section{A}" })
      .expect(201);

    const projectId = createRes.body.project.id as string;

    await request(app)
      .put(`/api/projects/${projectId}`)
      .send({ content: "\\section{B}", snapshotReason: "manual_save" })
      .expect(200);

    await request(app).post(`/api/projects/${projectId}/compile`).send({}).expect(200);

    const versionsRes = await request(app).get(`/api/projects/${projectId}/versions`).expect(200);
    expect(versionsRes.body.versions.length).toBeGreaterThanOrEqual(3);

    const targetVersion = versionsRes.body.versions[0].id as string;
    await request(app)
      .post(`/api/projects/${projectId}/versions/${targetVersion}/restore`)
      .send({})
      .expect(200);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.content).toContain("\\section");
  });

  it("returns 404 json when latest PDF path is missing on disk", async () => {
    const dbPath = path.join(process.cwd(), `.tmp-${randomUUID()}.sqlite`);
    tempFiles.push(dbPath);

    const app = createApp({
      dbPath,
      dockerReadyFn: () => true,
      compileFn: async () => ({
        status: "success",
        errors: [],
        warnings: [],
        durationMs: 50,
        log: "ok",
        pdfAbsPath: "/tmp/does-not-exist.pdf"
      })
    });

    const createRes = await request(app)
      .post("/api/projects")
      .send({ title: "Missing PDF", content: "\\section{A}" })
      .expect(201);

    const projectId = createRes.body.project.id as string;

    await request(app).post(`/api/projects/${projectId}/compile`).send({}).expect(200);

    const latestRes = await request(app).get(`/api/projects/${projectId}/pdf/latest`).expect(404);
    expect(latestRes.body.error).toMatch(/not found on disk/i);
  });

  it("serves latest and version PDF files stored under .data", async () => {
    const dbPath = path.join(process.cwd(), `.tmp-${randomUUID()}.sqlite`);
    const dataRoot = path.resolve(process.cwd(), "../../.data");
    const pdfPath = path.join(dataRoot, `test-${randomUUID()}.pdf`);

    tempFiles.push(dbPath, pdfPath);
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    fs.writeFileSync(pdfPath, "%PDF-1.1\n%%EOF\n", "utf-8");

    const app = createApp({
      dbPath,
      dockerReadyFn: () => true,
      compileFn: async () => ({
        status: "success",
        errors: [],
        warnings: [],
        durationMs: 50,
        log: "ok",
        pdfAbsPath: pdfPath
      })
    });

    const createRes = await request(app)
      .post("/api/projects")
      .send({ title: "PDF Serve", content: "\\section{A}" })
      .expect(201);

    const projectId = createRes.body.project.id as string;
    await request(app).post(`/api/projects/${projectId}/compile`).send({}).expect(200);

    const latestRes = await request(app).get(`/api/projects/${projectId}/pdf/latest`).expect(200);
    expect(latestRes.headers["content-type"]).toContain("application/pdf");

    const versionsRes = await request(app).get(`/api/projects/${projectId}/versions`).expect(200);
    const versionId = versionsRes.body.versions[0].id as string;

    const versionPdfRes = await request(app)
      .get(`/api/projects/${projectId}/versions/${versionId}/download`)
      .expect(200);
    expect(versionPdfRes.headers["content-type"]).toContain("application/pdf");
  });

  it("returns markdown preview through pandoc endpoint", async () => {
    const dbPath = path.join(process.cwd(), `.tmp-${randomUUID()}.sqlite`);
    tempFiles.push(dbPath);

    const app = createApp({
      dbPath,
      dockerReadyFn: () => true,
      markdownPreviewFn: async (latex) => ({
        markdown: `converted:${latex.slice(0, 16)}`,
        warnings: ["stub warning"]
      })
    });

    const createRes = await request(app)
      .post("/api/projects")
      .send({ title: "Preview", content: "\\section{Hello}" })
      .expect(201);

    const projectId = createRes.body.project.id as string;

    const previewRes = await request(app)
      .post(`/api/projects/${projectId}/preview/markdown`)
      .send({ content: "\\section{Updated}" })
      .expect(200);

    expect(previewRes.body.markdown).toContain("converted:\\section{Updated");
    expect(previewRes.body.warnings).toEqual(["stub warning"]);
  });
});
