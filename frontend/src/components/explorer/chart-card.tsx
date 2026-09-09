"use client";

import { ChartPreview } from "@/components/visualization/chart-preview";
import type { ChartTypeDefinition } from "@/lib/visualization/registry";
import { CHART_PREVIEW_SPECS } from "@/lib/visualization/chart-preview-specs";

/** One of the few places full card treatment is correct -- each card is a genuinely selectable
 * object browsed among many peers. Kept deliberately light: preview + name + subcategory only.
 * No shadow, no hover lift -- border/background shift, matching the rest of the system. */
export function ChartCard({
  def,
  selected,
  onSelect,
}: {
  def: ChartTypeDefinition;
  selected?: boolean;
  onSelect: () => void;
}) {
  const preview = CHART_PREVIEW_SPECS[def.id];

  return (
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onSelect}
      className={`flex flex-col overflow-hidden rounded-[var(--radius-md-token)] border text-left transition-colors ${
        selected ? "border-accent" : "border-border hover:border-border-strong"
      }`}
    >
      <div aria-hidden className="pointer-events-none">
        {preview ? (
          <ChartPreview spec={preview.spec} rows={preview.rows} heightPx={110} />
        ) : (
          <div className="flex h-[110px] items-center justify-center bg-surface-muted text-2xl text-muted-foreground">
            ▭
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-[13.5px] font-semibold text-foreground">{def.label}</p>
        <p className="truncate text-[11.5px] text-subtle-foreground">
          {def.subcategory.replaceAll("_", " ")}
        </p>
      </div>
    </button>
  );
}
