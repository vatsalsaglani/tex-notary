import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-primary/40 bg-primary text-primary-foreground shadow-[0_1px_0_hsl(var(--highlight)/0.35)_inset,0_16px_28px_-18px_hsl(var(--primary)/0.72)] hover:-translate-y-[0.5px] hover:brightness-105",
        secondary:
          "border border-border/70 bg-secondary/78 text-secondary-foreground shadow-[0_1px_0_hsl(var(--highlight)/0.5)_inset] hover:bg-secondary/95",
        ghost: "text-foreground hover:bg-muted/65",
        outline:
          "border border-border/80 bg-card/62 text-foreground shadow-[0_1px_0_hsl(var(--highlight)/0.5)_inset,0_10px_24px_-18px_hsl(var(--shadow)/0.55)] hover:bg-card/82",
        danger: "bg-danger/90 text-white hover:bg-danger"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
