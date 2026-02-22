import {
  BookmarkPlus,
  Braces,
  Download,
  ListPlus,
  LoaderCircle,
  Play,
  Save,
  Sigma,
  Telescope
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

interface ToolbarProps {
  projectTitle: string;
  compileReady: boolean;
  loading: boolean;
  saving: boolean;
  compiling: boolean;
  onTitleChange: (value: string) => void;
  onSave: () => void;
  onSnapshot: () => void;
  onCompile: () => void;
  onDownloadLatest: () => void;
  onInsertSnippet: (type: "section" | "equation" | "itemize") => void;
}

function compilerLabel(ready: boolean) {
  return ready ? "ready" : "offline";
}

export function Toolbar({
  projectTitle,
  compileReady,
  loading,
  saving,
  compiling,
  onTitleChange,
  onSave,
  onSnapshot,
  onCompile,
  onDownloadLatest,
  onInsertSnippet
}: ToolbarProps) {
  return (
    <div className="space-y-3 border-b border-border/65 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-10 min-w-[230px] flex-1 bg-card"
          value={projectTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Untitled project"
        />
        <Badge
          variant={compileReady ? "success" : "warning"}
          className={cn("capitalize", compileReady ? "text-success" : "text-warning")}
        >
          <Telescope className="mr-1 h-3 w-3" />
          compiler {compilerLabel(compileReady)}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/55 p-1 shadow-[0_1px_0_hsl(var(--highlight)/0.5)_inset] backdrop-blur-xl">
          <Button size="sm" variant="outline" onClick={() => onInsertSnippet("section")}>
            <ListPlus className="h-4 w-4" />
            Section
          </Button>
          <Button size="sm" variant="outline" onClick={() => onInsertSnippet("equation")}>
            <Sigma className="h-4 w-4" />
            Equation
          </Button>
          <Button size="sm" variant="outline" onClick={() => onInsertSnippet("itemize")}>
            <Braces className="h-4 w-4" />
            Itemize
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/55 p-1 shadow-[0_1px_0_hsl(var(--highlight)/0.5)_inset] backdrop-blur-xl">
          <Button size="sm" variant="outline" disabled={loading || saving} onClick={onSave}>
            <Save className="h-4 w-4" />
            {saving ? "Saving" : "Save"}
          </Button>
          <Button size="sm" variant="outline" disabled={loading || saving} onClick={onSnapshot}>
            <BookmarkPlus className="h-4 w-4" />
            Snapshot
          </Button>
          <Button size="sm" disabled={loading || compiling} onClick={onCompile}>
            {compiling ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {compiling ? "Compiling PDF" : "Compile PDF"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onDownloadLatest}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
