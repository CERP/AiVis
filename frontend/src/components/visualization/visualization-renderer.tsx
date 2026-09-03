"use client";

import { useEffect, useRef, useState } from "react";
import type { View } from "vega";

import { DataTable } from "@/components/visualization/data-table";
import { KPICard } from "@/components/visualization/kpi-card";
import { getChartDefinition } from "@/lib/visualization/registry";
import { compileToVegaLite } from "@/lib/visualization/to-vega-lite";
import type { VisualizationSpec } from "@/lib/visualization/spec";
import type { ThemeTokens } from "@/lib/api/theme";
import { cn } from "@/lib/utils";

interface VisualizationRendererProps {
  spec: VisualizationSpec;
  rows: Record<string, unknown>[];
  theme?: ThemeTokens;
  className?: string;
  onReady?: (view: View | null) => void;
}

export function VisualizationRenderer({
  spec,
  rows,
  theme,
  className,
  onReady,
}: VisualizationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const componentRenderer = getChartDefinition(spec.chart_type)?.renderer === "component";

  useEffect(() => {
    if (componentRenderer) return;
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
        cleanup = () => {
          onReady?.(null);
          result.view.finalize();
        };
        setError(null);
        onReady?.(result.view);
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
    // onReady is intentionally excluded: it's a callback ref setter, not render input --
    // including it would re-run this effect (and re-create the Vega view) whenever the
    // parent re-renders with a new inline function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, rows, theme, componentRenderer]);

  if (spec.chart_type === "kpi") {
    return <KPICard spec={spec} rows={rows} />;
  }
  if (spec.chart_type === "table") {
    return <DataTable rows={rows} title={spec.typography.title} />;
  }

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
