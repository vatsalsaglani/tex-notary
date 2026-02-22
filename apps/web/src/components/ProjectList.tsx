import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FilePlus2, FileText, FileUp, PanelLeftClose, Plus, Sparkles } from "lucide-react";
import type { ProjectListItem } from "@overleaf-lite/shared";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";

interface ProjectListProps {
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  onCreate: () => void;
  onImportFiles: (files: FileList | File[]) => void;
  importing?: boolean;
  onToggleSidebar?: () => void;
}

function statusVariant(status: ProjectListItem["lastCompileStatus"]): "success" | "danger" | "muted" {
  if (status === "success") {
    return "success";
  }
  if (status === "error") {
    return "danger";
  }
  return "muted";
}

function hasFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function ProjectList({
  projects,
  selectedProjectId,
  onSelect,
  onCreate,
  onImportFiles,
  importing = false,
  onToggleSidebar
}: ProjectListProps) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const dragOverlayLabel = useMemo(() => {
    if (importing) {
      return "Importing files...";
    }
    return "Drop .tex or .txt files to create project";
  }, [importing]);

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      onImportFiles(event.target.files);
    }
    event.target.value = "";
  }

  useEffect(() => {
    if (!actionsMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (actionsMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setActionsMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [actionsMenuOpen]);

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    setIsDraggingFiles(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isDraggingFiles) {
      setIsDraggingFiles(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsDraggingFiles(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files.length > 0) {
      onImportFiles(event.dataTransfer.files);
    }
  }

  function handleCreateAction() {
    setActionsMenuOpen(false);
    onCreate();
  }

  function handleImportAction() {
    setActionsMenuOpen(false);
    fileInputRef.current?.click();
  }

  return (
    <Card
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden transition-colors",
        isDraggingFiles ? "border-primary/70 bg-primary/5" : undefined
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className="border-b border-border/70 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Projects</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Unlimited local workspaces</p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".tex,.txt,text/plain"
              multiple
              onChange={handleFileInputChange}
            />
            <div className="relative" ref={actionsMenuRef}>
              <Button
                size="icon"
                disabled={importing}
                aria-label="Create or import project"
                title="Create or import project"
                onClick={() => setActionsMenuOpen((open) => !open)}
              >
                <Plus className="h-4 w-4" />
              </Button>

              {actionsMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.45rem)] z-30 w-44 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-soft backdrop-blur-xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/65"
                    onClick={handleCreateAction}
                  >
                    <FilePlus2 className="h-4 w-4 text-primary" />
                    New file
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/65"
                    onClick={handleImportAction}
                  >
                    <FileUp className="h-4 w-4 text-primary" />
                    Import file
                  </button>
                </div>
              ) : null}
            </div>
            {onToggleSidebar ? (
              <Button
                size="icon"
                variant="outline"
                className="shrink-0 border-border/90 bg-card/85 text-foreground shadow-soft hover:bg-card"
                onClick={onToggleSidebar}
                aria-label="Hide projects sidebar"
                title="Hide projects sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="v-scroll flex-1 space-y-2 overflow-auto p-3">
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          </div>
        ) : null}

        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={cn(
              "w-full rounded-lg border p-3 text-left transition-all",
              "hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-soft",
              selectedProjectId === project.id
                ? "border-primary/60 bg-primary/10"
                : "border-border/80 bg-card/60"
            )}
            onClick={() => onSelect(project.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{project.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(project.updatedAt).toLocaleString()}</p>
              </div>
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <Badge variant={statusVariant(project.lastCompileStatus)}>
                {project.lastCompileStatus ?? "uncompiled"}
              </Badge>
            </div>
          </button>
        ))}
      </CardContent>

      {isDraggingFiles ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-card/65 p-4 backdrop-blur-sm">
          <div className="rounded-xl border border-primary/50 bg-card/90 px-4 py-3 text-center shadow-soft">
            <FileUp className="mx-auto mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-foreground">{dragOverlayLabel}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
