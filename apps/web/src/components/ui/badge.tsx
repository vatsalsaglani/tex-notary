import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide shadow-[0_1px_0_hsl(var(--highlight)/0.4)_inset] backdrop-blur-lg transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/35 bg-primary/16 text-primary",
        success: "border-success/35 bg-success/14 text-success",
        warning: "border-warning/35 bg-warning/14 text-warning",
        danger: "border-danger/35 bg-danger/14 text-danger",
        muted: "border-border/80 bg-muted/62 text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
