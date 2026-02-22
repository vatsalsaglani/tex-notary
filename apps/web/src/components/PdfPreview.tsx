import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { FileCode2, FileDown, FileText, LoaderCircle, PanelRightClose, Sparkles, TriangleAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";

interface PreviewPanelProps {
  mode: "markdown" | "pdf";
  onModeChange: (mode: "markdown" | "pdf") => void;
  markdownPreview: string;
  markdownError: string | null;
  markdownRendering: boolean;
  markdownWarnings: string[];
  pdfUrl: string | null;
  pdfCompiling: boolean;
  onTogglePreviewPanel?: () => void;
}

export function PreviewPanel({
  mode,
  onModeChange,
  markdownPreview,
  markdownError,
  markdownRendering,
  markdownWarnings,
  pdfUrl,
  pdfCompiling,
  onTogglePreviewPanel
}: PreviewPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/85 shadow-card backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <h2 className="font-display text-base">Preview</h2>
        <div className="flex items-center gap-2">
          <FileDown className="h-4 w-4 text-muted-foreground" />
          {onTogglePreviewPanel ? (
            <Button
              size="icon"
              variant="outline"
              onClick={onTogglePreviewPanel}
              aria-label="Hide preview sidebar"
              title="Hide preview sidebar"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs
        value={mode}
        onValueChange={(value) => onModeChange(value as "markdown" | "pdf")}
        className="flex h-full min-h-0 flex-col p-3"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="markdown" className="gap-1.5">
            <FileCode2 className="h-3.5 w-3.5" />
            Markdown
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            PDF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="markdown" className="relative mt-3 min-h-0 flex-1">
          {markdownRendering ? (
            <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-border/70 bg-card/85 px-2 py-1 text-xs text-muted-foreground shadow-sm">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Rendering
            </div>
          ) : null}

          {markdownError ? (
            <div className="grid h-full place-items-center rounded-lg border border-danger/30 bg-danger/10 p-5 text-center">
              <div>
                <TriangleAlert className="mx-auto mb-2 h-5 w-5 text-danger" />
                <p className="font-medium text-danger">Markdown preview failed</p>
                <p className="mt-1 text-sm text-danger/90">{markdownError}</p>
              </div>
            </div>
          ) : markdownPreview ? (
            <div className="v-scroll h-full overflow-auto rounded-lg border border-border/70 bg-card/60">
              <div className="markdown-preview">
                {markdownWarnings.length > 0 ? (
                  <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {markdownWarnings[0]}
                  </div>
                ) : null}
                <div className="markdown-canvas">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {markdownPreview}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-lg border border-border/60 bg-muted/20 p-6 text-center">
              <div>
                <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="font-medium">Start typing to render Markdown preview</p>
                <p className="mt-1 text-sm text-muted-foreground">Markdown updates automatically via Pandoc.</p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pdf" className="mt-3 min-h-0 flex-1">
          {pdfUrl ? (
            <iframe className="h-full w-full rounded-lg border border-border/60 bg-muted/50" src={pdfUrl} title="Compiled PDF Preview" />
          ) : (
            <div className="grid h-full place-items-center rounded-lg border border-border/60 bg-muted/20 p-6 text-center">
              <div>
                {pdfCompiling ? (
                  <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                )}
                <p className="font-medium">{pdfCompiling ? "Compiling PDF preview" : "Switch to PDF to compile"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pdfCompiling
                    ? "This takes a few seconds depending on document size."
                    : "PDF compiles on demand to keep editing fast."}
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
