"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group mx-4 my-8"
      toastOptions={{
        classNames: {
          toast:
            "font-sans py-3 px-4 group toast group-[.toaster]:bg-white/70 group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-black/30 group-[.toaster]:backdrop-blur-xl rounded-2xl wora-border group-[.toaster]:text-black dark:group-[.toaster]:text-white",
          description:
            "group-[.toast]:text-black/50 dark:group-[.toast]:text-white/50",
          actionButton:
            "group-[.toast]:bg-neutral-900 group-[.toast]:text-neutral-50 dark:group-[.toast]:bg-neutral-50 dark:group-[.toast]:text-neutral-900",
          cancelButton:
            "group-[.toast]:bg-neutral-100 group-[.toast]:text-neutral-500 dark:group-[.toast]:bg-neutral-800 dark:group-[.toast]:text-neutral-400",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
