import type {
  CompileRunResponse,
  OutlineItem,
  Project,
  ProjectListItem,
  VersionSnapshot,
  CompileMessage
} from "@overleaf-lite/shared";

export interface ProjectDocResponse {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface HealthResponse {
  ok: boolean;
  dockerReady: boolean;
  pandocReady?: boolean;
  compileReady?: boolean;
  compileBackend?: "docker" | "local" | null;
  backendPreference?: "auto" | "docker" | "local";
  localCompiler?: "tectonic" | "latexmk" | "pdflatex" | null;
  dockerImage?: string;
}

export interface MarkdownPreviewResponse {
  markdown: string;
  warnings: string[];
}

const runtimeApiBase =
  typeof window !== "undefined" && typeof window.__OVERLEAF_API_BASE__ === "string"
    ? window.__OVERLEAF_API_BASE__
    : undefined;
const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? runtimeApiBase ?? "";
const API_BASE = configuredApiBase.replace(/\/$/, "");

function apiUrl(route: string) {
  return `${API_BASE}${route}`;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // Ignore invalid json body.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function getHealth() {
  return request<HealthResponse>(apiUrl("/api/health"));
}

export async function listProjects() {
  return request<{ projects: ProjectListItem[] }>(apiUrl("/api/projects"));
}

export async function createProject(payload?: { title?: string; content?: string }) {
  return request<{ project: Project }>(apiUrl("/api/projects"), {
    method: "POST",
    body: JSON.stringify(payload ?? {})
  });
}

export async function getProject(projectId: string) {
  return request<ProjectDocResponse>(apiUrl(`/api/projects/${projectId}`));
}

export async function updateProject(
  projectId: string,
  payload: { title?: string; content?: string; snapshotReason?: "manual_save" | "autosave" }
) {
  return request<{ project: Project }>(apiUrl(`/api/projects/${projectId}`), {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function compileProject(projectId: string, createSnapshot = true) {
  return request<CompileRunResponse>(apiUrl(`/api/projects/${projectId}/compile`), {
    method: "POST",
    body: JSON.stringify({ createSnapshot })
  });
}

export async function getOutline(projectId: string) {
  return request<{ items: OutlineItem[] }>(apiUrl(`/api/projects/${projectId}/outline`));
}

export async function listVersions(projectId: string) {
  return request<{
    versions: Array<Pick<VersionSnapshot, "id" | "createdAt" | "label" | "compileStatus">>;
  }>(apiUrl(`/api/projects/${projectId}/versions`));
}

export async function previewProjectMarkdown(projectId: string, content: string) {
  return request<MarkdownPreviewResponse>(apiUrl(`/api/projects/${projectId}/preview/markdown`), {
    method: "POST",
    body: JSON.stringify({ content })
  });
}

export async function restoreVersion(projectId: string, versionId: string) {
  return request<{ restored: VersionSnapshot }>(apiUrl(`/api/projects/${projectId}/versions/${versionId}/restore`), {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function fetchLatestPdfBlob(projectId: string) {
  const response = await fetch(apiUrl(`/api/projects/${projectId}/pdf/latest?ts=${Date.now()}`));
  if (!response.ok) {
    throw new Error("No PDF available");
  }

  return response.blob();
}

export function latestPdfDownloadUrl(projectId: string) {
  return apiUrl(`/api/projects/${projectId}/pdf/latest`);
}

export function versionPdfDownloadUrl(projectId: string, versionId: string) {
  return apiUrl(`/api/projects/${projectId}/versions/${versionId}/download`);
}

export function summarizeCompile(errors: CompileMessage[], warnings: CompileMessage[]) {
  return `${errors.length} errors · ${warnings.length} warnings`;
}
