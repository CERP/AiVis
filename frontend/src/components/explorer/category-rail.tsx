"use client";

import type { ChartCategory } from "@/lib/visualization/registry";
import { categoriesWithCounts } from "@/lib/visualization/chart-taxonomy";
import { cn } from "@/lib/utils";

/** Filters, not scroll-anchors -- only the active category's charts render at all, per the
 * anti-"41-card wall" decision. Plain text nav, matching the accent-underline language already
 * used by the global nav and StageTabs, not a pill/icon rail. Below the lg breakpoint this
 * collapses to a horizontal chip row (see className overrides applied by the caller). */
export function CategoryRail({
  active,
  onChange,
  className,
}: {
  active: ChartCategory | null;
  onChange: (category: ChartCategory | null) => void;
  className?: string;
}) {
  const categories = categoriesWithCounts();

  return (
    <nav aria-label="Chart categories" className={className}>
      <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
        {categories.map(({ category, label, count }) => {
          const isActive = active === category;
          return (
            <li key={category}>
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => onChange(isActive ? null : category)}
                className={cn(
                  "block w-full whitespace-nowrap rounded-[var(--radius-sm-token)] border-b-2 px-2 py-2 text-left text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:border-b-0 lg:border-l-2",
                  isActive
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                <span className="ml-1.5 font-mono text-[11px] text-subtle-foreground">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
