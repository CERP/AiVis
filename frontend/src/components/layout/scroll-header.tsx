"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Constant header height prevents the scroll threshold moving during contraction. */
export function ScrollHeader({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const update = () => setCompact(window.scrollY > 48);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className="scroll-header sticky top-0 z-40 h-[72px] shrink-0" data-compact={compact}>
      {children}
    </header>
  );
}
