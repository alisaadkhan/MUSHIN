import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-base transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-white/20 hover:border-white/20 focus-visible:outline-none focus-visible:border-purple-500/50 focus-visible:bg-purple-500/[0.04] focus-visible:shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)] disabled:cursor-not-allowed disabled:opacity-40 md:text-sm font-medium text-white",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
