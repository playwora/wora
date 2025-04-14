import { useEffect, useState } from "react";

type PageTransitionProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

export const PageTransition = ({
  children,
  isLoading = false,
}: PageTransitionProps) => {
  const [mounted, setMounted] = useState(false);

  // Animate in on first mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`page-transition w-full transition-all duration-300 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"} ${isLoading ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"}`}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </div>
  );
};
