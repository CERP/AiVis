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
}: RecommendationCardProps) {
  const chartDef = getChartDefinition(recommendation.spec.chart_type);
  const confidencePct = Math.round(recommendation.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
        {previewRows && previewRows.length > 0 ? (
          <div className="flex h-28 items-center justify-center overflow-hidden bg-surface-muted p-2">
            <VisualizationRenderer
              spec={{
                ...recommendation.spec,
                layout: { ...recommendation.spec.layout, height: 96, show_legend: false },
              }}
              rows={previewRows}
              className="pointer-events-none h-full"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="flex h-28 items-center justify-center bg-surface-muted font-mono text-3xl tracking-widest text-muted-foreground"
          >
            {CHART_TYPE_GLYPH[recommendation.spec.chart_type] ?? "▭"}
          </div>
        )}
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-3">
            <SectionHeading as="h3" className="text-lg">
              {recommendation.title}
            </SectionHeading>
            <ConfidenceBadge pct={confidencePct} />
          </div>
          <ChartLabel className="text-muted-foreground">
            {chartDef?.label ?? recommendation.spec.chart_type}
          </ChartLabel>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted-foreground">{recommendation.description}</p>
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

function ConfidenceBadge({ pct }: { pct: number }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-xs font-medium text-muted-foreground"
      )}
      title="Confidence"
    >
      {pct}%
    </span>
  );
}
