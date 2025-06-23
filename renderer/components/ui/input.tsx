import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl bg-black/5 px-3 py-1 text-xs ring-inset transition duration-300 placeholder:text-black/50 focus:outline-hidden focus:ring-2 focus:ring-black dark:bg-white/10 dark:placeholder:text-white/50 dark:focus:ring-white",
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
