"use client";

import { Check, HelpCircle } from "lucide-react";

import { ChartPreview } from "@/components/visualization/chart-preview";
import { Button } from "@/components/ui/button";
import type { VisualizationRecommendation } from "@/lib/api/types";
import { classifyFinding } from "@/lib/finding-classification";
import { cn } from "@/lib/utils";

interface FindingRowProps {
  recommendation: VisualizationRecommendation;
  previewRows?: Record<string, unknown>[];
  onOpenStudio: (recommendation: VisualizationRecommendation) => void;
  isOpeningStudio?: boolean;
  isFavorite?: boolean;
  isTogglingFavorite?: boolean;
  onToggleFavorite?: (recommendation: VisualizationRecommendation) => void;
}

/** Insight vs Exploration is signaled three ways, none of them color (see
 * lib/finding-classification.ts for why grammar isn't one of them): the label text itself, a
 * distinct glyph (resolved tick vs. question mark), and -- the one signal that IS real here --
 * the underlying category driving which fields/relationship framing appears. */
export function FindingRow({
  recommendation,
  previewRows,
  onOpenStudio,
  isOpeningStudio,
  isFavorite,
  isTogglingFavorite,
  onToggleFavorite,
}: FindingRowProps) {
  const kind = classifyFinding(recommendation.category);
  const fields = Object.values(recommendation.spec.encoding)
    .filter((encoding): encoding is NonNullable<typeof encoding> => !!encoding)
    .map((encoding) => encoding.field);
  const uniqueFields = Array.from(new Set(fields));

  return (
    <li className="flex flex-col gap-4 border-b border-border py-5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
          {kind === "insight" ? (
            <Check aria-hidden className="h-3 w-3" />
          ) : (
            <HelpCircle aria-hidden className="h-3 w-3" />
          )}
          {kind === "insight" ? "Insight" : "Exploration"}
        </span>
        <h3 className="text-[16px] font-semibold text-foreground">{recommendation.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {recommendation.description}
        </p>
        {uniqueFields.length > 0 && (
          <p className="mt-1.5 font-mono text-[12px] text-subtle-foreground">
            {uniqueFields.join(" · ")}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:w-[160px]">
        <ChartPreview spec={recommendation.spec} rows={previewRows} heightPx={140} />
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={isOpeningStudio}
            onClick={() => onOpenStudio(recommendation)}
          >
            {isOpeningStudio ? "Opening…" : "Open in Studio"}
          </Button>
          {onToggleFavorite && (
            <button
              type="button"
              aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
              aria-pressed={!!isFavorite}
              disabled={isTogglingFavorite}
              onClick={() => onToggleFavorite(recommendation)}
              className={cn(
                "text-base leading-none transition-colors disabled:opacity-50",
                isFavorite ? "text-accent" : "text-border-strong hover:text-accent"
              )}
            >
              {isFavorite ? "★" : "☆"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
