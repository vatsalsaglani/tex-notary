import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input/80 bg-card/65 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-[0_1px_0_hsl(var(--highlight)/0.55)_inset] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
