export type CompileStatus = "success" | "error";

export interface CompileMessage {
  line?: number;
  column?: number;
  message: string;
  raw: string;
}

export interface CompileResult {
  status: CompileStatus;
  errors: CompileMessage[];
  warnings: CompileMessage[];
  pdfPath?: string;
}

export interface Project {
  id: string;
  title: string;
  currentContent: string;
  createdAt: string;
  updatedAt: string;
  lastCompileStatus: CompileStatus | null;
}

export interface ProjectListItem {
  id: string;
  title: string;
  updatedAt: string;
  lastCompileStatus: CompileStatus | null;
}

export type SnapshotReason = "manual_save" | "autosave" | "compile" | "restore" | "init";

export interface VersionSnapshot {
  id: string;
  projectId: string;
  content: string;
  label: string | null;
  reason: SnapshotReason;
  compileStatus: CompileStatus | null;
  createdAt: string;
}

export interface OutlineItem {
  level: number;
  title: string;
  line: number;
}

export interface CompileRunResponse {
  compileId: string;
  status: CompileStatus;
  pdfAvailable: boolean;
  errors: CompileMessage[];
  warnings: CompileMessage[];
  durationMs: number;
}
