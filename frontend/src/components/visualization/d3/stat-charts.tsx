"use client";

import { scaleLinear } from "d3-scale";
import { arc as d3arc } from "d3-shape";
import { useMemo } from "react";

import type { ThemeTokens } from "@/lib/api/theme";
import {
  groupNumericByCategory,
  kernelDensityEstimate,
  quantileSorted,
  sumByCategory,
} from "@/lib/visualization/d3-data";
import { colorAt, useChartSize } from "./use-chart-size";

function EmptyNotice({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-[var(--radius-token)] border border-border bg-surface p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

interface CategoryValueProps {
  rows: Record<string, unknown>[];
  categoryField: string;
  valueField: string;
  theme?: ThemeTokens;
  title?: string | null;
}

/**
 * Violin plot with a real Gaussian kernel density estimate (Silverman bandwidth) -- see
 * `kernelDensityEstimate`. Each violin's half-width is that group's density rescaled by the
 * group's own maximum, which is the standard "equal-width" violin convention; the median and
 * quartile marks come from exact linear-interpolation quantiles, not from the smoothed curve.
 */
export function ViolinChart({ rows, categoryField, valueField, theme, title }: CategoryValueProps) {
  const { ref, width, height } = useChartSize(360);
  const margin = { top: 10, right: 16, bottom: 34, left: 48 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const model = useMemo(() => {
    const groups = groupNumericByCategory(rows, categoryField, valueField).filter(
      (g) => g.values.length >= 2
    );
    if (groups.length === 0 || innerWidth === 0) return null;

    const all = groups.flatMap((g) => g.values);
    const yScale = scaleLinear()
      .domain([Math.min(...all), Math.max(...all)])
      .nice()
      .range([innerHeight, 0]);

    const bandWidth = innerWidth / groups.length;
    const violins = groups.map((group, i) => {
      const density = kernelDensityEstimate(group.values);
      const maxDensity = Math.max(...density.map((d) => d.density), Number.EPSILON);
      const halfWidth = (bandWidth * 0.42) / maxDensity;
      const sorted = [...group.values].sort((a, b) => a - b);
      return {
        key: group.key,
        centre: bandWidth * i + bandWidth / 2,
        density,
        halfWidth,
        q1: quantileSorted(sorted, 0.25),
        median: quantileSorted(sorted, 0.5),
        q3: quantileSorted(sorted, 0.75),
        n: sorted.length,
      };
    });
    return { violins, yScale, bandWidth };
  }, [rows, categoryField, valueField, innerWidth, innerHeight]);

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {!model ? (
        <EmptyNotice message="Need at least two numeric values per group to estimate a distribution." />
      ) : (
        <svg width={width} height={height} role="img" aria-label={`${title ?? "Violin plot"}: distribution of ${valueField} across ${model.violins.length} groups`}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {model.yScale.ticks(5).map((tick) => (
              <g key={tick} transform={`translate(0,${model.yScale(tick)})`}>
                <line x2={innerWidth} stroke={theme?.grid ?? "#eee"} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={10} fill={theme?.foreground ?? "#666"}>
                  {tick}
                </text>
              </g>
            ))}
            {model.violins.map((v, i) => {
              const fill = colorAt(theme?.categorical_colors, i);
              // Mirror the density about the group centre to form the violin outline.
              const right = v.density.map((d) => `${v.centre + d.density * v.halfWidth},${model.yScale(d.x)}`);
              const left = [...v.density].reverse().map((d) => `${v.centre - d.density * v.halfWidth},${model.yScale(d.x)}`);
              return (
                <g key={v.key}>
                  <polygon points={[...right, ...left].join(" ")} fill={fill} fillOpacity={0.55} stroke={fill}>
                    <title>{`${v.key} (n=${v.n}) — median ${v.median.toFixed(2)}, IQR ${v.q1.toFixed(2)}–${v.q3.toFixed(2)}`}</title>
                  </polygon>
                  <line x1={v.centre} x2={v.centre} y1={model.yScale(v.q1)} y2={model.yScale(v.q3)} stroke={theme?.foreground ?? "#333"} strokeWidth={4} />
                  <circle cx={v.centre} cy={model.yScale(v.median)} r={3} fill="#fff" stroke={theme?.foreground ?? "#333"} />
                  <text x={v.centre} y={innerHeight + 16} textAnchor="middle" fontSize={10} fill={theme?.foreground ?? "#666"}>
                    {v.key}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

/**
 * Funnel chart drawn as real trapezoids: each stage's top edge is the previous stage's width and
 * its bottom edge is its own, so the sloping sides genuinely represent drop-off. (Rendering this
 * as a bar chart would misstate the shape, which is why Vega-Lite isn't used here.) Stage order
 * is the order the data supplies -- never alphabetised, since process order is meaningful.
 */
export function FunnelChart({ rows, categoryField, valueField, theme, title }: CategoryValueProps) {
  const { ref, width, height } = useChartSize(340);

  const stages = useMemo(() => sumByCategory(rows, categoryField, valueField), [rows, categoryField, valueField]);
  if (stages.length === 0) {
    return <EmptyNotice message="No stages found to build a funnel." />;
  }

  const maxValue = Math.max(...stages.map((s) => s.value), Number.EPSILON);
  const stageHeight = height / stages.length;
  const widthFor = (v: number) => (v / maxValue) * (width * 0.82);

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <svg width={width} height={height} role="img" aria-label={`${title ?? "Funnel"}: ${stages.length} stages from ${stages[0]?.value.toLocaleString()} to ${stages[stages.length - 1]?.value.toLocaleString()}`}>
        {stages.map((stage, i) => {
          const topWidth = widthFor(stage.value);
          const bottomWidth = widthFor(stages[i + 1]?.value ?? stage.value);
          const y = i * stageHeight;
          const cx = width / 2;
          const points = [
            `${cx - topWidth / 2},${y}`,
            `${cx + topWidth / 2},${y}`,
            `${cx + bottomWidth / 2},${y + stageHeight - 2}`,
            `${cx - bottomWidth / 2},${y + stageHeight - 2}`,
          ].join(" ");
          const conversion = i === 0 ? 100 : (stage.value / stages[0].value) * 100;
          const stepDrop = i === 0 ? null : (stage.value / stages[i - 1].value) * 100;
          return (
            <g key={stage.key}>
              <polygon points={points} fill={colorAt(theme?.categorical_colors, i)} fillOpacity={0.85} stroke="#fff">
                <title>
                  {`${stage.key}: ${stage.value.toLocaleString()} (${conversion.toFixed(1)}% of first stage${stepDrop !== null ? `, ${stepDrop.toFixed(1)}% of previous` : ""})`}
                </title>
              </polygon>
              <text x={cx} y={y + stageHeight / 2} dy="0.35em" textAnchor="middle" fontSize={11} fill="#fff" style={{ pointerEvents: "none" }}>
                {stage.key} — {stage.value.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Gauge: a bounded value on a 180° arc with threshold bands and an optional target needle.
 * The sweep angle is a true linear interpolation of value between min and max, so the needle
 * position is proportional rather than eyeballed. Includes a text readout so the value is
 * available without perceiving the arc (accessibility, and gauges are hard to read precisely).
 */
export function GaugeChart({
  value,
  min,
  max,
  target,
  label,
  theme,
}: {
  value: number;
  min: number;
  max: number;
  target?: number | null;
  label?: string | null;
  theme?: ThemeTokens;
}) {
  const { ref, width } = useChartSize(200);
  const height = Math.max(120, width * 0.55);
  const radius = Math.min(width / 2, height) - 12;
  const innerRadius = radius * 0.62;

  const span = max - min || 1;
  const toAngle = (v: number) => -Math.PI / 2 + ((Math.min(Math.max(v, min), max) - min) / span) * Math.PI;

  const bandArc = d3arc().innerRadius(innerRadius).outerRadius(radius);
  const bands = [
    { from: min, to: min + span / 3, color: "#e5e2db" },
    { from: min + span / 3, to: min + (2 * span) / 3, color: "#cfc9bb" },
    { from: min + (2 * span) / 3, to: max, color: "#b8b0a0" },
  ];

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img" aria-label={`${label ?? "Gauge"}: ${value.toLocaleString()} of ${max.toLocaleString()}${target != null ? `, target ${target.toLocaleString()}` : ""}`}>
        <g transform={`translate(${width / 2},${height - 8})`}>
          {bands.map((band, i) => (
            <path
              key={i}
              d={bandArc({ startAngle: toAngle(band.from), endAngle: toAngle(band.to) } as never) ?? undefined}
              fill={band.color}
            />
          ))}
          <path
            d={bandArc({ startAngle: toAngle(min), endAngle: toAngle(value) } as never) ?? undefined}
            fill={theme?.categorical_colors?.[0] ?? "#4c78a8"}
          />
          {target != null && (
            <line
              x1={Math.cos(toAngle(target) - Math.PI / 2) * innerRadius}
              y1={Math.sin(toAngle(target) - Math.PI / 2) * innerRadius}
              x2={Math.cos(toAngle(target) - Math.PI / 2) * radius}
              y2={Math.sin(toAngle(target) - Math.PI / 2) * radius}
              stroke={theme?.negative_color ?? "#b5432a"}
              strokeWidth={3}
            />
          )}
          <text textAnchor="middle" y={-6} className="font-headline" fontSize={22} fontWeight="bold" fill={theme?.foreground ?? "#1a1815"}>
            {Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)}
          </text>
          <text textAnchor="middle" y={12} fontSize={10} fill={theme?.foreground ?? "#666"} opacity={0.7}>
            {min.toLocaleString()} – {max.toLocaleString()}
          </text>
        </g>
      </svg>
      {label && <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">{label}</p>}
    </div>
  );
}

/**
 * Radar chart: metrics on a shared polar grid. Each metric axis is normalised to its own
 * observed 0..max range before plotting -- without that, metrics on different units would be
 * silently incomparable, which is the classic radar-chart failure mode. The normalisation is
 * stated in the tooltip so a reader knows the axes are rescaled, not raw.
 */
export function RadarChart({
  rows,
  metricField,
  valueField,
  seriesField,
  theme,
  title,
}: {
  rows: Record<string, unknown>[];
  metricField: string;
  valueField: string;
  seriesField: string;
  theme?: ThemeTokens;
  title?: string | null;
}) {
  const { ref, width } = useChartSize(360);
  const height = Math.max(260, Math.min(width, 380));
  const radius = Math.min(width, height) / 2 - 40;

  const model = useMemo(() => {
    const metrics = [...new Set(rows.map((r) => String(r[metricField] ?? "")))].filter(Boolean);
    const series = [...new Set(rows.map((r) => String(r[seriesField] ?? "")))].filter(Boolean);
    if (metrics.length < 3 || series.length === 0 || radius <= 0) return null;

    // Per-metric max so axes with different units remain comparable after normalisation.
    const metricMax = new Map<string, number>();
    for (const row of rows) {
      const m = String(row[metricField] ?? "");
      const v = Number(row[valueField]);
      if (!Number.isFinite(v)) continue;
      metricMax.set(m, Math.max(metricMax.get(m) ?? 0, v));
    }

    const points = series.map((s) => {
      const values = metrics.map((m) => {
        const row = rows.find((r) => String(r[seriesField]) === s && String(r[metricField]) === m);
        const raw = Number(row?.[valueField]);
        const max = metricMax.get(m) ?? 0;
        return {
          metric: m,
          raw: Number.isFinite(raw) ? raw : 0,
          normalised: max > 0 && Number.isFinite(raw) ? raw / max : 0,
        };
      });
      return { series: s, values };
    });
    return { metrics, points };
  }, [rows, metricField, valueField, seriesField, radius]);

  const angleFor = (i: number, total: number) => (i / total) * 2 * Math.PI - Math.PI / 2;

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {!model ? (
        <EmptyNotice message="A radar chart needs at least three metrics and one series." />
      ) : (
        <svg width={width} height={height} role="img" aria-label={`${title ?? "Radar chart"}: ${model.metrics.length} metrics across ${model.points.length} series, each axis normalised to its own maximum`}>
          <g transform={`translate(${width / 2},${height / 2})`}>
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <polygon
                key={r}
                points={model.metrics
                  .map((_, i) => {
                    const a = angleFor(i, model.metrics.length);
                    return `${Math.cos(a) * radius * r},${Math.sin(a) * radius * r}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={theme?.grid ?? "#e5e5e5"}
              />
            ))}
            {model.metrics.map((metric, i) => {
              const a = angleFor(i, model.metrics.length);
              return (
                <g key={metric}>
                  <line x2={Math.cos(a) * radius} y2={Math.sin(a) * radius} stroke={theme?.grid ?? "#e5e5e5"} />
                  <text
                    x={Math.cos(a) * (radius + 16)}
                    y={Math.sin(a) * (radius + 16)}
                    textAnchor="middle"
                    dy="0.32em"
                    fontSize={10}
                    fill={theme?.foreground ?? "#555"}
                  >
                    {metric}
                  </text>
                </g>
              );
            })}
            {model.points.map((point, si) => {
              const coords = point.values.map((v, i) => {
                const a = angleFor(i, model.metrics.length);
                return [Math.cos(a) * radius * v.normalised, Math.sin(a) * radius * v.normalised] as [number, number];
              });
              const color = colorAt(theme?.categorical_colors, si);
              return (
                <polygon key={point.series} points={coords.map((c) => c.join(",")).join(" ")} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2}>
                  <title>
                    {`${point.series}\n${point.values.map((v) => `${v.metric}: ${v.raw.toLocaleString()} (${(v.normalised * 100).toFixed(0)}% of axis max)`).join("\n")}`}
                  </title>
                </polygon>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
