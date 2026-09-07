"use client";

import { Check } from "lucide-react";

import type { ThemeTokens } from "@/lib/api/theme";
import { cn } from "@/lib/utils";

export function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeTokens;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start rounded-[calc(var(--radius-token)+4px)] border p-4 text-left transition-colors",
        selected ? "border-accent bg-accent-muted" : "border-border bg-surface hover:border-border-strong"
      )}
    >
      <div className="mb-3.5 flex gap-1.5">
        {theme.categorical_colors.slice(0, 4).map((color, i) => (
          <span key={i} className="block h-6 w-6 rounded-md" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="mb-0.5 text-[14.5px] font-semibold">{theme.name.replace(/_/g, " ")}</div>
      <div className="text-xs text-subtle-foreground">{theme.description}</div>
      {selected && (
        <div className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-accent-hover">
          <Check aria-hidden className="h-3.5 w-3.5" />
          Selected
        </div>
      )}
    </button>
  );
}
