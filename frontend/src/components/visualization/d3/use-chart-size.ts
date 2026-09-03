"use client";

import { useEffect, useRef, useState } from "react";

/** ResizeObserver-driven container sizing, so every D3 chart is responsive by construction
 * rather than each one re-implementing (or forgetting) width tracking. */
export function useChartSize(defaultHeight = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: defaultHeight });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: defaultHeight });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: defaultHeight });
    return () => observer.disconnect();
  }, [defaultHeight]);

  return { ref, ...size };
}

/** Colour cycling helper -- keeps categorical colour assignment stable and theme-driven. */
export function colorAt(palette: string[] | undefined, index: number): string {
  const fallback = ["#4c78a8", "#f58518", "#e45756", "#72b7b2", "#54a24b", "#eeca3b", "#b279a2"];
  const source = palette && palette.length > 0 ? palette : fallback;
  return source[index % source.length];
}
