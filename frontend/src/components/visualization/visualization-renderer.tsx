"use client";

import { useEffect, useRef, useState } from "react";

import { compileToVegaLite } from "@/lib/visualization/to-vega-lite";
import type { VisualizationSpec } from "@/lib/visualization/spec";
import type { ThemeTokens } from "@/lib/api/theme";
import { cn } from "@/lib/utils";

interface VisualizationRendererProps {
  spec: VisualizationSpec;
  rows: Record<string, unknown>[];
  theme?: ThemeTokens;
  className?: string;
}

export function VisualizationRenderer({
  spec,
  rows,
  theme,
  className,
}: VisualizationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function render() {
      if (!containerRef.current) return;
      try {
        const vegaEmbed = (await import("vega-embed")).default;
        const vlSpec = compileToVegaLite(spec, rows, theme);
        const result = await vegaEmbed(containerRef.current, vlSpec, {
          actions: false,
          renderer: "svg",
        });
        if (cancelled) {
          result.view.finalize();
          return;
        }
        cleanup = () => result.view.finalize();
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render visualization");
        }
      }
    }

    render();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [spec, rows, theme]);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-[var(--radius-token)] border border-negative/30 bg-accent-muted p-4 text-sm text-negative"
      >
        Couldn&apos;t render this visualization: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={spec.typography.title ?? `${spec.chart_type} chart`}
      className={cn("w-full", className)}
    />
  );
}
