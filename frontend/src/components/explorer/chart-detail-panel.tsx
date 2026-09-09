"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChartTypeDefinition } from "@/lib/visualization/registry";
import { compatibilityDescription } from "@/lib/visualization/chart-taxonomy";

/** Desktop (lg+): a static flex sibling that pushes the chart grid -- no position:fixed, no
 * scrim, no focus trap, since it behaves like part of the page rather than a modal. Below lg,
 * the same content becomes a full overlay sheet with a backdrop and Escape-to-close, because
 * there's no room to push content meaningfully at that width. One component, two presentations,
 * controlled entirely by responsive classes rather than JS breakpoint branching. */
export function ChartDetailPanel({
  def,
  onUse,
  onClose,
  isCreating,
}: {
  def: ChartTypeDefinition;
  onUse: () => void;
  onClose: () => void;
  isCreating?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-40 bg-panel/45 lg:hidden"
        onClick={onClose}
      />
      <aside
        aria-label={`${def.label} details`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-[var(--radius-lg-token)] border-t border-border bg-surface p-5 lg:sticky lg:top-[104px] lg:inset-auto lg:z-auto lg:max-h-none lg:w-[320px] lg:shrink-0 lg:rounded-[var(--radius-md-token)] lg:border lg:border-border lg:p-4"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-foreground">{def.label}</h2>
          <button
            type="button"
            aria-label="Close chart details"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
            Best for
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{def.description}</p>
        </div>

        <div className="mb-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
            Compatible fields
          </p>
          <p className="text-[13px] text-muted-foreground">{compatibilityDescription(def)}</p>
        </div>

        <Button variant="accent" className="w-full" disabled={isCreating} onClick={onUse}>
          {isCreating ? "Opening…" : "Use this chart"}
        </Button>
      </aside>
    </>
  );
}
