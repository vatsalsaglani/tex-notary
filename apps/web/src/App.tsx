import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { motion } from "framer-motion";
import {
  Eye,
  LayoutPanelLeft,
  LoaderCircle,
  Moon,
  PanelLeftOpen,
  PanelRightOpen,
  Sun,
  SquarePen
} from "lucide-react";
import type { editor } from "monaco-editor";
import type { CompileMessage, ProjectListItem } from "@overleaf-lite/shared";
import {
  compileProject,
  createProject,
  fetchLatestPdfBlob,
  getHealth,
  getProject,
  latestPdfDownloadUrl,
  listProjects,
  listVersions,
  previewProjectMarkdown,
  restoreVersion,
  summarizeCompile,
  updateProject,
  type HealthResponse,
  versionPdfDownloadUrl
} from "./api";
import { BottomDrawer } from "./components/BottomDrawer";
import { PreviewPanel } from "./components/PdfPreview";
import { ProjectList } from "./components/ProjectList";
import { Toolbar } from "./components/Toolbar";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  configureLatexMonaco,
  LATEX_MONACO_THEME_DARK,
  LATEX_MONACO_THEME_LIGHT
} from "./editor/latexMonaco";
import appIconUrl from "./assets/app-icon.svg";
import { cn } from "./lib/utils";
import { parseOutlineClient } from "./utils/outline";

interface VersionListItem {
  id: string;
  createdAt: string;
  label: string | null;
  compileStatus: "success" | "error" | null;
}

const snippetMap: Record<"section" | "equation" | "itemize", string> = {
  section: "\\section{New Section}\n",
  equation: "\\begin{equation}\n  E = mc^2\n\\end{equation}\n",
  itemize: "\\begin{itemize}\n  \\item First item\n\\end{itemize}\n"
};

const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1024px)";
const MARKDOWN_PREVIEW_DEBOUNCE_MS = 260;
const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const IMPORT_ALLOWED_EXTENSIONS = [".tex", ".txt", ".ltx"];

function compilerBadgeVariant(compileHealth: HealthResponse | null): "success" | "warning" {
  if (!compileHealth?.compileReady) {
    return "warning";
  }
  return "success";
}

function resolveEditorTheme(mode: "dark" | "light") {
  return mode === "dark" ? LATEX_MONACO_THEME_DARK : LATEX_MONACO_THEME_LIGHT;
}

function resolveInitialThemeMode() {
  if (typeof window === "undefined") {
    return "light" as const;
  }

  const stored = window.localStorage.getItem("theme-mode");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileHealth, setCompileHealth] = useState<HealthResponse | null>(null);
  const [compileErrors, setCompileErrors] = useState<CompileMessage[]>([]);
  const [compileWarnings, setCompileWarnings] = useState<CompileMessage[]>([]);
  const [versions, setVersions] = useState<VersionListItem[]>([]);
  const [activeTab, setActiveTab] = useState<"outline" | "errors" | "versions">("outline");
  const [themeMode, setThemeMode] = useState<"dark" | "light">(resolveInitialThemeMode);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches : true
  );
  const [previewMode, setPreviewMode] = useState<"markdown" | "pdf">("markdown");
  const [markdownPreview, setMarkdownPreview] = useState("");
  const [markdownPreviewError, setMarkdownPreviewError] = useState<string | null>(null);
  const [markdownWarnings, setMarkdownWarnings] = useState<string[]>([]);
  const [markdownRendering, setMarkdownRendering] = useState(false);
  const [pdfCompiling, setPdfCompiling] = useState(false);
  const [lastCompiledPdfContent, setLastCompiledPdfContent] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"projects" | "editor" | "preview">("editor");
  const [importingFiles, setImportingFiles] = useState(false);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const markdownRenderTokenRef = useRef(0);
  const outline = useMemo(() => parseOutlineClient(content), [content]);
  const isMacDesktop = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    if (window.__TEX_NOTARY_RUNTIME__?.isElectron) {
      return window.__TEX_NOTARY_RUNTIME__.isMac;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform.toLowerCase();
    return userAgent.includes("electron") && platform.includes("mac");
  }, []);

  useEffect(() => {
    void refreshProjects();
    void refreshHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("theme-mode", themeMode);
    document.documentElement.classList.toggle("theme-dark", themeMode === "dark");
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    monacoRef.current?.editor.setTheme(resolveEditorTheme(themeMode));
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!selectedProjectId) {
      setMarkdownPreview("");
      setMarkdownPreviewError(null);
      setMarkdownWarnings([]);
      setMarkdownRendering(false);
      return;
    }

    const renderToken = markdownRenderTokenRef.current + 1;
    markdownRenderTokenRef.current = renderToken;

    const timeoutId = window.setTimeout(() => {
      setMarkdownRendering(true);

      void previewProjectMarkdown(selectedProjectId, content)
        .then(({ markdown, warnings }) => {
          if (markdownRenderTokenRef.current !== renderToken) {
            return;
          }
          setMarkdownPreview(markdown);
          setMarkdownWarnings(warnings);
          setMarkdownPreviewError(null);
        })
        .catch((error: unknown) => {
          if (markdownRenderTokenRef.current !== renderToken) {
            return;
          }
          setMarkdownPreview("");
          setMarkdownWarnings([]);
          setMarkdownPreviewError(error instanceof Error ? error.message : "Unable to render Markdown preview.");
        })
        .finally(() => {
          if (markdownRenderTokenRef.current === renderToken) {
            setMarkdownRendering(false);
          }
        });
    }, MARKDOWN_PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [content, selectedProjectId]);

  async function refreshHealth() {
    try {
      const health = await getHealth();
      setCompileHealth(health);
    } catch {
      setCompileHealth({
        ok: false,
        dockerReady: false,
        pandocReady: false,
        compileReady: false,
        compileBackend: null,
        localCompiler: null
      });
    }
  }

  async function refreshProjectList() {
    const projectResponse = await listProjects();
    setProjects(projectResponse.projects);
    return projectResponse.projects;
  }

  async function refreshProjects(selectId?: string) {
    const projectList = await refreshProjectList();

    const nextId = selectId ?? selectedProjectId ?? projectList[0]?.id ?? null;
    if (nextId) {
      await loadProject(nextId);
    }
  }

  async function loadProject(projectId: string) {
    setLoading(true);
    try {
      const project = await getProject(projectId);
      setSelectedProjectId(projectId);
      setTitle(project.title);
      setContent(project.content);
      setLastCompiledPdfContent(null);
      setStatusMessage(`Loaded ${project.title}`);
      await refreshVersions(projectId);
      await refreshPdf(projectId);
    } finally {
      setLoading(false);
    }
  }

  async function refreshVersions(projectId: string) {
    const response = await listVersions(projectId);
    setVersions(response.versions);
  }

  async function refreshPdf(projectId: string) {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    try {
      const blob = await fetchLatestPdfBlob(projectId);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch {
      setPdfUrl(null);
    }
  }

  const onEditorMount: OnMount = (editorInstance, monaco) => {
    configureLatexMonaco(monaco);
    monaco.editor.setTheme(resolveEditorTheme(themeMode));
    const model = editorInstance.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, "latex");
    }
    editorRef.current = editorInstance;
    monacoRef.current = monaco;
  };

  function jumpToLine(line: number) {
    const editorInstance = editorRef.current;
    const model = editorInstance?.getModel();
    if (!editorInstance || !model) {
      return;
    }

    const lineNumber = Math.min(Math.max(1, line), model.getLineCount());
    editorInstance.revealLineInCenterIfOutsideViewport(lineNumber);
    editorInstance.setSelection({
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: 1
    });
    editorInstance.setPosition({ lineNumber, column: 1 });
    editorInstance.focus();
  }

  async function handleCreateProject() {
    setLoading(true);
    try {
      const response = await createProject();
      await refreshProjects(response.project.id);
      setStatusMessage("Created new project");
      setPreviewMode("markdown");
      setMobileView("editor");
    } finally {
      setLoading(false);
    }
  }

  function normalizeImportedTitle(fileName: string) {
    const trimmed = fileName.trim();
    if (!trimmed) {
      return `Imported ${new Date().toLocaleString()}`;
    }

    return trimmed.replace(/\.[^/.]+$/, "").trim() || `Imported ${new Date().toLocaleString()}`;
  }

  function isSupportedImportFile(file: File) {
    const lowerName = file.name.toLowerCase();
    if (IMPORT_ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      return true;
    }
    return file.type.startsWith("text/");
  }

  async function handleImportFiles(inputFiles: FileList | File[]) {
    const files = Array.from(inputFiles);
    if (files.length === 0 || importingFiles) {
      return;
    }

    const supportedFiles = files.filter(isSupportedImportFile);
    if (supportedFiles.length === 0) {
      setStatusMessage("No supported files selected. Please import .tex or .txt files.");
      return;
    }

    setImportingFiles(true);
    setLoading(true);
    setMobileView("editor");

    try {
      const createdProjectIds: string[] = [];
      let skippedCount = 0;

      for (const file of supportedFiles) {
        if (file.size > IMPORT_MAX_BYTES) {
          skippedCount += 1;
          continue;
        }

        const raw = await file.text();
        const contentToSave = raw.trim().length > 0 ? raw : "% Imported file was empty\n";
        const response = await createProject({
          title: normalizeImportedTitle(file.name),
          content: contentToSave
        });
        createdProjectIds.push(response.project.id);
      }

      const selectedId = createdProjectIds.at(-1);
      if (selectedId) {
        await refreshProjects(selectedId);
        setPreviewMode("markdown");
      } else {
        await refreshProjectList();
      }

      const createdCount = createdProjectIds.length;
      if (createdCount > 0) {
        const suffix = skippedCount > 0 ? ` (${skippedCount} skipped: over 2MB)` : "";
        setStatusMessage(`Imported ${createdCount} project${createdCount === 1 ? "" : "s"}${suffix}`);
      } else {
        setStatusMessage("No files imported. Ensure files are under 2MB.");
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? `Import failed: ${error.message}` : "Import failed");
    } finally {
      setImportingFiles(false);
      setLoading(false);
    }
  }

  async function handleSave(snapshotReason?: "manual_save") {
    if (!selectedProjectId) {
      return;
    }

    setSaving(true);
    try {
      await updateProject(selectedProjectId, {
        title,
        content,
        snapshotReason
      });
      await refreshProjectList();
      await refreshVersions(selectedProjectId);
      setStatusMessage(snapshotReason ? "Snapshot saved" : "Project saved");
    } finally {
      setSaving(false);
    }
  }

  async function runPdfCompile(createSnapshot: boolean, trigger: "manual" | "preview-tab" = "manual") {
    if (!selectedProjectId || compiling) {
      return;
    }

    setCompiling(true);
    if (trigger === "preview-tab") {
      setPdfCompiling(true);
    }

    try {
      await updateProject(selectedProjectId, { title, content });
      const result = await compileProject(selectedProjectId, createSnapshot);
      setCompileErrors(result.errors);
      setCompileWarnings(result.warnings);
      const summary = summarizeCompile(result.errors, result.warnings);
      setStatusMessage(result.status === "success" ? `Compile succeeded (${summary})` : `Compile failed (${summary})`);

      if (createSnapshot) {
        await refreshVersions(selectedProjectId);
      }
      await refreshProjectList();

      if (result.status === "success") {
        await refreshPdf(selectedProjectId);
        setLastCompiledPdfContent(content);
        if (trigger === "manual") {
          setPreviewMode("pdf");
          setMobileView("preview");
        }
      } else {
        setActiveTab("errors");
      }
    } finally {
      setPdfCompiling(false);
      setCompiling(false);
      await refreshHealth();
    }
  }

  async function handleCompile() {
    await runPdfCompile(true, "manual");
  }

  async function handlePreviewModeChange(nextMode: "markdown" | "pdf") {
    setPreviewMode(nextMode);

    if (nextMode !== "pdf" || !selectedProjectId) {
      return;
    }

    if (content === lastCompiledPdfContent && pdfUrl) {
      return;
    }

    await runPdfCompile(false, "preview-tab");
  }

  async function handleRestore(versionId: string) {
    if (!selectedProjectId) {
      return;
    }

    await restoreVersion(selectedProjectId, versionId);
    await loadProject(selectedProjectId);
    setStatusMessage(`Restored snapshot ${versionId.slice(0, 8)}`);
  }

  function handleDownloadLatest() {
    if (!selectedProjectId) {
      return;
    }

    window.open(latestPdfDownloadUrl(selectedProjectId), "_blank", "noopener,noreferrer");
  }

  function handleDownloadVersion(versionId: string) {
    if (!selectedProjectId) {
      return;
    }

    window.open(versionPdfDownloadUrl(selectedProjectId, versionId), "_blank", "noopener,noreferrer");
  }

  function insertSnippet(kind: "section" | "equation" | "itemize") {
    const snippet = snippetMap[kind];
    const editorInstance = editorRef.current;

    if (!editorInstance) {
      setContent((previous) => `${previous}\n${snippet}`);
      return;
    }

    const selection = editorInstance.getSelection();
    if (!selection) {
      setContent((previous) => `${previous}\n${snippet}`);
      return;
    }

    editorInstance.executeEdits("snippet", [
      {
        range: selection,
        text: snippet,
        forceMoveMarkers: true
      }
    ]);
    setContent(editorInstance.getValue());
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const platform = window.navigator.platform.toLowerCase();
    const isMac = platform.includes("mac");

    const onKeyDown = (event: KeyboardEvent) => {
      const hasMod = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (hasMod) {
        if (key === "s") {
          event.preventDefault();
          if (event.shiftKey) {
            void handleSave("manual_save");
          } else {
            void handleSave();
          }
          return;
        }

        if (key === "r" && event.shiftKey) {
          event.preventDefault();
          if (!selectedProjectId || compiling) {
            return;
          }
          void handlePreviewModeChange("pdf");
          return;
        }

        if (key === "enter" && !event.shiftKey) {
          event.preventDefault();
          void handleCompile();
          return;
        }

        if (key === "b" && !event.shiftKey && isDesktopViewport) {
          event.preventDefault();
          setSidebarCollapsed((collapsed) => !collapsed);
          return;
        }

        if (key === "p" && event.shiftKey && isDesktopViewport) {
          event.preventDefault();
          setPreviewCollapsed((collapsed) => !collapsed);
          return;
        }
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !isEditableTarget(event.target)) {
        if (key === "1") {
          event.preventDefault();
          setActiveTab("outline");
          return;
        }
        if (key === "2") {
          event.preventDefault();
          setActiveTab("errors");
          return;
        }
        if (key === "3") {
          event.preventDefault();
          setActiveTab("versions");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    compiling,
    content,
    isDesktopViewport,
    selectedProjectId,
    title
  ]);

  function renderEditorCanvas(withBottomTabs = true) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/85 shadow-card backdrop-blur-md">
        <Toolbar
          projectTitle={title}
          compileReady={Boolean(compileHealth?.compileReady)}
          loading={loading}
          saving={saving}
          compiling={compiling}
          onTitleChange={setTitle}
          onSave={() => {
            void handleSave();
          }}
          onSnapshot={() => {
            void handleSave("manual_save");
          }}
          onCompile={() => {
            void handleCompile();
          }}
          onDownloadLatest={handleDownloadLatest}
          onInsertSnippet={insertSnippet}
        />

        {withBottomTabs ? (
          <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
            <ResizablePanel defaultSize={72} minSize={45}>
              <div className="monaco-shell h-full min-h-0" data-editor-theme={themeMode}>
                <Editor
                  height="100%"
                  defaultLanguage="latex"
                  language="latex"
                  theme={resolveEditorTheme(themeMode)}
                  value={content}
                  onMount={onEditorMount}
                  onChange={(nextValue) => setContent(nextValue ?? "")}
                  options={{
                    minimap: { enabled: false },
                    fontLigatures: true,
                    fontFamily: "IBM Plex Mono, Menlo, Monaco, monospace",
                    fontSize: 14,
                    lineNumbersMinChars: 3,
                    smoothScrolling: true,
                    wordWrap: "on",
                    padding: { top: 10 }
                  }}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={28} minSize={18}>
              <BottomDrawer
                activeTab={activeTab}
                onTabChange={setActiveTab}
                outline={outline}
                errors={compileErrors}
                warnings={compileWarnings}
                versions={versions}
                onJumpToLine={jumpToLine}
                onRestoreVersion={(versionId) => {
                  void handleRestore(versionId);
                }}
                onDownloadVersion={handleDownloadVersion}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <>
            <div className="monaco-shell h-[55vh] min-h-[320px] border-t border-border/70" data-editor-theme={themeMode}>
              <Editor
                height="100%"
                defaultLanguage="latex"
                language="latex"
                theme={resolveEditorTheme(themeMode)}
                value={content}
                onMount={onEditorMount}
                onChange={(nextValue) => setContent(nextValue ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontLigatures: true,
                  fontFamily: "IBM Plex Mono, Menlo, Monaco, monospace",
                  fontSize: 14,
                  lineNumbersMinChars: 3,
                  smoothScrolling: true,
                  wordWrap: "on",
                  padding: { top: 10 }
                }}
              />
            </div>
            <div className="max-h-[36vh] min-h-[180px] border-t border-border/70">
              <BottomDrawer
                activeTab={activeTab}
                onTabChange={setActiveTab}
                outline={outline}
                errors={compileErrors}
                warnings={compileWarnings}
                versions={versions}
                onJumpToLine={jumpToLine}
                onRestoreVersion={(versionId) => {
                  void handleRestore(versionId);
                }}
                onDownloadVersion={handleDownloadVersion}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full overflow-hidden p-3 lg:p-4", isMacDesktop ? "pt-10 lg:pt-10" : undefined)}>
      <motion.div
        className="grain-layer pointer-events-none absolute inset-0 opacity-40"
        animate={{ opacity: [0.34, 0.5, 0.34] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      {isMacDesktop ? <div className="window-native-chrome fixed inset-x-0 top-0 z-40 h-10" aria-hidden /> : null}

      <div className="relative z-10 flex h-full flex-col gap-3">
        <motion.header
          className="relative glass-panel mx-auto w-full max-w-[1800px] rounded-[1.55rem] border-border/75 bg-card/72 px-3.5 py-2.5 lg:flex lg:items-center lg:justify-between"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={cn("min-w-0", isMacDesktop ? "pl-0" : undefined)}>
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={appIconUrl}
                alt="TeX Notary icon"
                className="h-9 w-9 shrink-0 rounded-lg border border-border/70 bg-card/80 p-1 shadow-soft"
              />
              <div className="min-w-0">
                <h1 className="truncate font-display text-[2.05rem] leading-none text-foreground">TeX Notary</h1>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{statusMessage}</p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-border/75 bg-card/68 px-2 py-1 shadow-soft lg:flex">
            <Badge variant={compilerBadgeVariant(compileHealth)}>
              {compileHealth?.compileReady ? "Compiler ready" : "Compiler offline"}
            </Badge>
            <Badge variant="muted">{projects.length} projects</Badge>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}
              aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
            >
              {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          <div className="space-y-2 lg:hidden">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}
                aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
                title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
              >
                {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
            <Tabs value={mobileView} onValueChange={(value) => setMobileView(value as typeof mobileView)}>
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="projects">
                  <LayoutPanelLeft className="mr-1 h-3.5 w-3.5" />
                  Projects
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="editor">
                  <SquarePen className="mr-1 h-3.5 w-3.5" />
                  Editor
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="preview">
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </motion.header>

        <motion.main
          className="min-h-0 flex-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          {isDesktopViewport ? (
            <div className="relative h-full">
              <ResizablePanelGroup direction="horizontal" className="h-full">
                {!sidebarCollapsed ? (
                  <>
                    <ResizablePanel defaultSize={18} minSize={14}>
                      <ProjectList
                        projects={projects}
                        selectedProjectId={selectedProjectId}
                        onSelect={(projectId) => {
                          void loadProject(projectId);
                        }}
                        onCreate={() => {
                          void handleCreateProject();
                        }}
                        onImportFiles={(files) => {
                          void handleImportFiles(files);
                        }}
                        importing={importingFiles}
                        onToggleSidebar={() => setSidebarCollapsed(true)}
                      />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                  </>
                ) : null}

                <ResizablePanel defaultSize={previewCollapsed ? 82 : 52} minSize={36}>
                  {renderEditorCanvas(true)}
                </ResizablePanel>

                {!previewCollapsed ? (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={30} minSize={22}>
                      <PreviewPanel
                        mode={previewMode}
                        onModeChange={(mode) => {
                          void handlePreviewModeChange(mode);
                        }}
                        markdownPreview={markdownPreview}
                        markdownError={markdownPreviewError}
                        markdownRendering={markdownRendering}
                        markdownWarnings={markdownWarnings}
                        pdfUrl={pdfUrl}
                        pdfCompiling={pdfCompiling}
                        onTogglePreviewPanel={() => setPreviewCollapsed(true)}
                      />
                    </ResizablePanel>
                  </>
                ) : null}
              </ResizablePanelGroup>

              {sidebarCollapsed ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-card/75 shadow-soft backdrop-blur-xl"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Show projects sidebar"
                  title="Show projects sidebar"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              ) : null}

              {previewCollapsed ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-card/75 shadow-soft backdrop-blur-xl"
                  onClick={() => setPreviewCollapsed(false)}
                  aria-label="Show preview sidebar"
                  title="Show preview sidebar"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="h-full">
              {mobileView === "projects" ? (
                <ProjectList
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onSelect={(projectId) => {
                    void loadProject(projectId);
                    setMobileView("editor");
                  }}
                  onCreate={() => {
                    void handleCreateProject();
                  }}
                  onImportFiles={(files) => {
                    void handleImportFiles(files);
                  }}
                  importing={importingFiles}
                />
              ) : null}

              {mobileView === "editor" ? renderEditorCanvas(false) : null}

              {mobileView === "preview" ? (
                <PreviewPanel
                  mode={previewMode}
                  onModeChange={(mode) => {
                    void handlePreviewModeChange(mode);
                  }}
                  markdownPreview={markdownPreview}
                  markdownError={markdownPreviewError}
                  markdownRendering={markdownRendering}
                  markdownWarnings={markdownWarnings}
                  pdfUrl={pdfUrl}
                  pdfCompiling={pdfCompiling}
                />
              ) : null}
            </div>
          )}
        </motion.main>

        {(saving || compiling) && (
          <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-sm shadow-soft backdrop-blur-md">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {compiling ? "Compiling document..." : "Saving..."}
          </div>
        )}
      </div>
    </div>
  );
}
