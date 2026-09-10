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
    // A real <button> here would nest ChartPreview's live-rendered charts (some chart types,
    // e.g. hierarchy trees, render their own interactive <button> rows) inside another
    // <button> -- invalid HTML that also breaks the true nested control's focus/click. `div` +
    // role="button" is the same pattern the upload dropzone uses for the same reason.
    <div
      role="button"
      tabIndex={0}
      aria-pressed={!!selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-md-token)] border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
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
    </div>
  );
}
