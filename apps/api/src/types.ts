import type { CompileMessage, CompileStatus, SnapshotReason } from "@overleaf-lite/shared";

export interface CompileExecutionResult {
  status: CompileStatus;
  errors: CompileMessage[];
  warnings: CompileMessage[];
  durationMs: number;
  pdfAbsPath?: string;
  log: string;
}

export interface CompileInput {
  projectId: string;
  versionId: string;
  content: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  current_content: string;
  created_at: string;
  updated_at: string;
  last_compile_status: CompileStatus | null;
}

export interface VersionRecord {
  id: string;
  project_id: string;
  content: string;
  label: string | null;
  reason: SnapshotReason;
  compile_status: CompileStatus | null;
  compile_log: string | null;
  pdf_rel_path: string | null;
  created_at: string;
}
