"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "group/slider wora-transition relative flex w-full cursor-pointer touch-none select-none items-center",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow origin-center overflow-hidden rounded-full bg-black/5 duration-300 hover:h-2 active:h-3 dark:bg-white/10">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-black duration-300 dark:bg-white" />
    </SliderPrimitive.Track>
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
