"use client";

import type { ColumnProfile } from "@/lib/api/insights";
import type { ThemeTokens } from "@/lib/api/theme";
import type { Encodings } from "@/lib/visualization/spec";
import { encodingTypeForColumn } from "@/lib/visualization/encoding-helpers";
import { getChartDefinition, type EncodingChannel } from "@/lib/visualization/registry";

/** The only channels backend/app/visualization/commands.py's change_field accepts (verified by
 * reading it directly, not assumed) -- x2/y2/measure2/open/high/low/close are set by
 * chart-type-specific Vega builders server-side, never by manual command. Showing an editable
 * control for those would silently 422 on every use, so they're surfaced as a read-only note
 * instead of a fake dropdown -- see NON_MAPPABLE_NOTE below. */
const MAPPABLE_CHANNELS: EncodingChannel[] = ["x", "y", "color", "size", "detail"];

const DEFAULT_LABELS: Record<string, string> = {
  x: "X-Axis",
  y: "Y-Axis",
  color: "Color / Legend",
  size: "Size",
  detail: "Detail (tooltip)",
  x2: "Range end (X)",
  y2: "Range end (Y)",
  measure2: "Secondary measure",
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
};

/** Per-chart-type label overrides for the SAME underlying x/y/color/size channels -- a sankey's
 * "x" is conceptually its source node, not a literal horizontal axis. This is copy only; the
 * command sent for a given channel is identical regardless of label. */
const CHART_TYPE_LABEL_OVERRIDES: Record<string, Partial<Record<string, string>>> = {
  sankey: { x: "Source", y: "Target", size: "Measure" },
  network: { x: "Source", y: "Target", size: "Measure" },
  chord: { x: "Source", y: "Target", size: "Measure" },
  kpi: { size: "Value", x: "Trend (optional)" },
  candlestick: { x: "Date" },
  ohlc: { x: "Date" },
  gantt: { x: "Start", y: "Task" },
};

const AGGREGATIONS = ["none", "sum", "mean", "median", "count", "min", "max"] as const;

function channelLabel(chartType: string, channel: string): string {
  return CHART_TYPE_LABEL_OVERRIDES[chartType]?.[channel] ?? DEFAULT_LABELS[channel] ?? channel;
}

export function MappingTab({
  chartType,
  encoding,
  columns,
  activeTheme,
  disabled,
  onChangeField,
  onChangeAggregation,
}: {
  chartType: string;
  encoding: Encodings;
  columns: ColumnProfile[];
  activeTheme?: ThemeTokens;
  disabled?: boolean;
  onChangeField: (channel: string, field: string, encodingType: string) => void;
  onChangeAggregation: (channel: string, aggregation: string) => void;
}) {
  const def = getChartDefinition(chartType);
  const relevant = def
    ? [...def.requiredEncodings, ...def.optionalEncodings]
    : MAPPABLE_CHANNELS;

  const mappableRelevant = relevant.filter((ch) => MAPPABLE_CHANNELS.includes(ch));
  const nonMappableRelevant = relevant.filter((ch) => !MAPPABLE_CHANNELS.includes(ch));
  const channels = mappableRelevant.length > 0 ? mappableRelevant : MAPPABLE_CHANNELS;

  return (
    <div className="flex flex-col gap-4">
      {channels.map((channel) => {
        const current = encoding[channel as keyof Encodings];
        return (
          <div key={channel} className="flex flex-col gap-1">
            <label htmlFor={`studio-channel-${channel}`} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
              {channelLabel(chartType, channel)}
            </label>
            <div className="flex items-center gap-1.5">
              {channel === "color" && current && (
                <span
                  aria-hidden
                  title="Uses the active theme's color palette"
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-strong"
                  style={{ backgroundColor: activeTheme?.categorical_colors[0] }}
                />
              )}
              <select
                id={`studio-channel-${channel}`}
                className="h-8 w-full rounded-[var(--radius-sm-token)] border border-border-strong bg-surface px-2 text-[12.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                value={current?.field ?? ""}
                disabled={disabled || columns.length === 0}
                onChange={(e) => {
                  const field = e.target.value;
                  if (!field) return;
                  const column = columns.find((c) => c.name === field);
                  if (!column) return;
                  onChangeField(channel, field, encodingTypeForColumn(column));
                }}
              >
                <option value="">— none —</option>
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} — {col.semantic_type ?? "unknown"}
                  </option>
                ))}
              </select>
            </div>
            {current && (
              <select
                aria-label={`Aggregation for ${channelLabel(chartType, channel)}`}
                className="h-7 rounded-[var(--radius-sm-token)] border border-border-strong bg-surface px-2 text-[11.5px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                value={current.aggregation ?? "none"}
                disabled={disabled}
                onChange={(e) => onChangeAggregation(channel, e.target.value)}
              >
                {AGGREGATIONS.map((agg) => (
                  <option key={agg} value={agg}>
                    {agg === "none" ? "no aggregation" : agg}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}

      {nonMappableRelevant.length > 0 && (
        <p className="text-[11.5px] leading-relaxed text-subtle-foreground">
          Also uses: {nonMappableRelevant.map((ch) => channelLabel(chartType, ch)).join(", ")} —
          set automatically from matching fields, not yet manually editable.
        </p>
      )}
    </div>
  );
}
