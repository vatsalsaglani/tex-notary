import type { CompileMessage, OutlineItem } from "@overleaf-lite/shared";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  History,
  ListTree,
  RotateCcw,
  TriangleAlert
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface VersionItem {
  id: string;
  createdAt: string;
  label: string | null;
  compileStatus: "success" | "error" | null;
}

interface BottomDrawerProps {
  activeTab: "outline" | "errors" | "versions";
  outline: OutlineItem[];
  errors: CompileMessage[];
  warnings: CompileMessage[];
  versions: VersionItem[];
  onTabChange: (tab: "outline" | "errors" | "versions") => void;
  onJumpToLine: (line: number) => void;
  onRestoreVersion: (versionId: string) => void;
  onDownloadVersion: (versionId: string) => void;
}

export function BottomDrawer({
  activeTab,
  outline,
  errors,
  warnings,
  versions,
  onTabChange,
  onJumpToLine,
  onRestoreVersion,
  onDownloadVersion
}: BottomDrawerProps) {
  return (
    <div className="h-full min-h-0 border-t border-border/70 p-3">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="outline" className="gap-1.5">
            <ListTree className="h-3.5 w-3.5" />
            Outline
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Errors
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Versions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outline" className="v-scroll max-h-48 overflow-auto pr-1">
          {outline.length === 0 ? <p className="px-1 py-3 text-sm text-muted-foreground">No sections found.</p> : null}
          <div className="space-y-2">
            {outline.map((item) => (
              <button
                key={`${item.line}-${item.title}`}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-left text-sm transition hover:border-primary/40"
                style={{ paddingLeft: `${item.level * 14 + 12}px` }}
                onClick={() => onJumpToLine(item.line)}
              >
                <span className="truncate">{item.title || "(untitled)"}</span>
                <span className="text-xs text-muted-foreground">L{item.line}</span>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="errors" className="v-scroll max-h-48 overflow-auto pr-1">
          {errors.length === 0 && warnings.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              No compile diagnostics.
            </div>
          ) : null}
          <div className="space-y-2">
            {errors.map((error, index) => (
              <button
                key={`error-${index}`}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-left text-sm text-danger"
                onClick={() => error.line && onJumpToLine(error.line)}
              >
                <span className="mr-2 truncate">{error.message}</span>
                <span className="text-xs">{error.line ? `L${error.line}` : "No line"}</span>
              </button>
            ))}
            {warnings.map((warning, index) => (
              <button
                key={`warning-${index}`}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-left text-sm text-warning"
                onClick={() => warning.line && onJumpToLine(warning.line)}
              >
                <span className="mr-2 truncate">{warning.message}</span>
                <span className="text-xs">{warning.line ? `L${warning.line}` : "No line"}</span>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="versions" className="v-scroll max-h-48 overflow-auto pr-1">
          {versions.length === 0 ? <p className="px-1 py-3 text-sm text-muted-foreground">No snapshots yet.</p> : null}
          <div className="space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="rounded-lg border border-border/70 bg-card/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{version.label ?? "Snapshot"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge
                    variant={
                      version.compileStatus === "success"
                        ? "success"
                        : version.compileStatus === "error"
                          ? "danger"
                          : "muted"
                    }
                  >
                    {version.compileStatus === "success" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : version.compileStatus === "error" ? (
                      <TriangleAlert className="mr-1 h-3 w-3" />
                    ) : null}
                    {version.compileStatus ?? "pending"}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onRestoreVersion(version.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDownloadVersion(version.id)}>
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
