"use client";

import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartLabel, SectionHeading } from "@/components/ui/typography";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { getChartDefinition } from "@/lib/visualization/registry";
import type { VisualizationRecommendation } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface RecommendationCardProps {
  recommendation: VisualizationRecommendation;
  index: number;
  previewRows?: Record<string, unknown>[];
  onOpenStudio?: (recommendation: VisualizationRecommendation) => void;
  isOpeningStudio?: boolean;
  isFavorite?: boolean;
  isTogglingFavorite?: boolean;
  onToggleFavorite?: (recommendation: VisualizationRecommendation) => void;
}

const CHART_TYPE_GLYPH: Record<string, string> = {
  bar: "▭▭▭",
  grouped_bar: "▥▥▥",
  line: "⟋",
  area: "▲",
  scatter: "⋮⋰",
  histogram: "▁▃▅",
  box_plot: "⊟",
  donut: "◍",
};

export function RecommendationCard({
  recommendation,
  index,
  previewRows,
  onOpenStudio,
  isOpeningStudio,
  isFavorite,
  isTogglingFavorite,
  onToggleFavorite,
}: RecommendationCardProps) {
  const chartDef = getChartDefinition(recommendation.spec.chart_type);
  const mappings = Object.entries(recommendation.spec.encoding)
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => !!entry[1])
    .map(([channel, encoding]) => `${channel.toUpperCase()}: ${encoding.field}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
        {previewRows && previewRows.length > 0 ? (
          <div className="flex h-52 items-center justify-center overflow-hidden border-b border-border bg-surface-muted p-3">
            <VisualizationRenderer
              spec={{
                ...recommendation.spec,
                typography: { ...recommendation.spec.typography, title: null },
                layout: { ...recommendation.spec.layout, height: 176, show_legend: false },
              }}
              rows={previewRows}
              className="pointer-events-none h-full"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="flex h-52 items-center justify-center bg-surface-muted font-mono text-3xl tracking-widest text-muted-foreground"
          >
            {CHART_TYPE_GLYPH[recommendation.spec.chart_type] ?? "▭"}
          </div>
        )}
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-3">
            <SectionHeading as="h3" className="line-clamp-3 text-lg md:text-lg">
              {recommendation.title}
            </SectionHeading>
            <div className="flex shrink-0 items-center gap-1.5">
              {onToggleFavorite && (
                <button
                  type="button"
                  aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                  aria-pressed={!!isFavorite}
                  disabled={isTogglingFavorite}
                  onClick={() => onToggleFavorite(recommendation)}
                  className={cn(
                    "text-lg leading-none transition-colors disabled:opacity-50",
                    isFavorite ? "text-accent" : "text-border-strong hover:text-accent"
                  )}
                >
                  {isFavorite ? "★" : "☆"}
                </button>
              )}
              <span className="shrink-0 rounded-full bg-accent-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-hover">
                {recommendation.spec.metadata.generated_by === "gemini" ? "Gemini" : "Computed"}
              </span>
            </div>
          </div>
          <ChartLabel className="text-muted-foreground">
            {chartDef?.label ?? recommendation.spec.chart_type}
          </ChartLabel>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{recommendation.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {mappings.map((mapping) => (
              <span key={mapping} className="rounded-md border border-border bg-surface-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                {mapping}
              </span>
            ))}
          </div>
          {recommendation.spec.metadata.reasoning && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Why this chart</summary>
              <p className="mt-2 leading-relaxed">{recommendation.spec.metadata.reasoning}</p>
            </details>
          )}
          {onOpenStudio && (
            <Button
              size="sm"
              variant="outline"
              className="mt-auto"
              onClick={() => onOpenStudio(recommendation)}
              disabled={isOpeningStudio}
            >
              {isOpeningStudio ? "Opening…" : "Open in studio"}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
