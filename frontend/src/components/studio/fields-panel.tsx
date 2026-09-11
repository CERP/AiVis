"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import type { ColumnProfile } from "@/lib/api/insights";
import type { Encodings } from "@/lib/visualization/spec";
import { CHART_REGISTRY } from "@/lib/visualization/registry";
import { cn } from "@/lib/utils";

const TYPE_GLYPH: Record<string, string> = {
  numeric: "#",
  currency: "#",
  date: "📅",
  categorical: "▤",
  text: "▤",
  boolean: "▤",
  identifier: "▤",
  geographic: "◎",
};

/** Fields are informational here, not editable -- mapping happens in the right inspector.
 * Secondary to the chart-type selector by design (chart type is usually already decided by the
 * time Studio opens, via a recommendation or Chart Explorer), which is why the selector is a
 * compact dropdown rather than a big icon grid. */
export function FieldsPanel({
  chartType,
  onChangeChartType,
  columns,
  currentEncoding,
  disabled,
}: {
  chartType: string;
  onChangeChartType: (chartType: string) => void;
  columns: ColumnProfile[];
  currentEncoding: Encodings;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const implementedCharts = CHART_REGISTRY.filter((c) => c.implemented);
  const mappedFieldNames = new Set(
    Object.values(currentEncoding)
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => e.field)
  );

  const visibleColumns = query.trim()
    ? columns.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : columns;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div>
        <label htmlFor="studio-chart-type" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
          Chart type
        </label>
        <select
          id="studio-chart-type"
          value={chartType}
          disabled={disabled}
          onChange={(e) => onChangeChartType(e.target.value)}
          className="h-8 w-full rounded-[var(--radius-sm-token)] border border-border-strong bg-surface px-2 text-[12.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {implementedCharts.map((chart) => (
            <option key={chart.id} value={chart.id}>
              {chart.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <label htmlFor="studio-field-search" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
          Fields
        </label>
        {columns.length > 8 && (
          <div className="relative mb-2">
            <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle-foreground" />
            <input
              id="studio-field-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              aria-label="Search fields"
              className="h-7 w-full rounded-[var(--radius-sm-token)] border border-border-strong bg-surface pl-6 pr-2 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </div>
        )}
        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {visibleColumns.map((column) => {
            const isMapped = mappedFieldNames.has(column.name);
            return (
              <li
                key={column.name}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm-token)] px-1.5 py-1 text-[12.5px]"
              >
                <span aria-hidden className="w-4 shrink-0 text-center font-mono text-[11px] text-subtle-foreground">
                  {TYPE_GLYPH[column.semantic_type ?? ""] ?? "▤"}
                </span>
                <span className="truncate text-foreground">{column.name}</span>
                {isMapped && (
                  <span
                    role="img"
                    aria-label={`${column.name} is currently mapped`}
                    title="Currently mapped"
                    className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent")}
                  />
                )}
              </li>
            );
          })}
          {visibleColumns.length === 0 && (
            <li className="px-1.5 py-1 text-[12px] text-subtle-foreground">No matching fields.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
