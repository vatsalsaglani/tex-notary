import { cn } from "../../lib/utils";
import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps
} from "react-resizable-panels";

interface ResizablePanelGroupProps extends Omit<GroupProps, "orientation"> {
  direction?: "horizontal" | "vertical";
}

const ResizablePanelGroup = ({ className, direction = "horizontal", ...props }: ResizablePanelGroupProps) => (
  <Group
    orientation={direction}
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col data-[panel-group-direction=horizontal]:flex-row",
      className
    )}
    {...props}
  />
);

const ResizablePanel = (props: PanelProps) => <Panel {...props} />;

const ResizableHandle = ({ withHandle, className, ...props }: SeparatorProps & { withHandle?: boolean }) => (
  <Separator
    className={cn(
      "relative flex items-center justify-center bg-border/55 after:pointer-events-none after:absolute after:content-[''] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70 aria-[orientation=vertical]:h-full aria-[orientation=vertical]:w-px aria-[orientation=vertical]:after:inset-y-0 aria-[orientation=vertical]:after:left-1/2 aria-[orientation=vertical]:after:w-4 aria-[orientation=vertical]:after:-translate-x-1/2 aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-4 aria-[orientation=horizontal]:after:-translate-y-1/2",
      className
    )}
    {...props}
  >
    {withHandle ? (
      <div className="z-10 flex h-6 w-4 items-center justify-center rounded-full border border-border/75 bg-card/82 text-muted-foreground shadow-[0_1px_0_hsl(var(--highlight)/0.55)_inset,0_8px_18px_-14px_hsl(var(--shadow)/0.65)] backdrop-blur-xl">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
    ) : null}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
