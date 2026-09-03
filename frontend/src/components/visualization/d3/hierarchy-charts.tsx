"use client";

import { arc as d3arc } from "d3-shape";
import { hierarchy, partition, treemap, treemapSquarify } from "d3-hierarchy";
import { useMemo, useState } from "react";

import type { ThemeTokens } from "@/lib/api/theme";
import { buildHierarchy, type HierarchyNode } from "@/lib/visualization/d3-data";
import { colorAt, useChartSize } from "./use-chart-size";

interface HierarchyChartProps {
  rows: Record<string, unknown>[];
  /** Grouping levels, outermost first. */
  levels: string[];
  valueField: string;
  theme?: ThemeTokens;
  title?: string | null;
}

function EmptyNotice({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-[var(--radius-token)] border border-border bg-surface p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/**
 * Treemap using d3-hierarchy's squarified tiling (Bruls/Huizing/van Wijk) -- the standard
 * algorithm, so rectangle *area* is exactly proportional to value and aspect ratios stay
 * readable. Nothing here approximates the layout.
 */
export function TreemapChart({ rows, levels, valueField, theme, title }: HierarchyChartProps) {
  const { ref, width, height } = useChartSize(360);

  const root = useMemo(() => {
    const data = buildHierarchy(rows, levels, valueField);
    if (!data.children?.length || width === 0) return null;
    const h = hierarchy<HierarchyNode>(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    treemap<HierarchyNode>().tile(treemapSquarify).size([width, height]).padding(2).round(true)(h);
    return h;
  }, [rows, levels, valueField, width, height]);

  const leaves = root?.leaves() ?? [];
  const total = root?.value ?? 0;

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {leaves.length === 0 ? (
        <EmptyNotice message="Not enough hierarchical data to build a treemap." />
      ) : (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title ?? "Treemap"}: ${leaves.length} segments totalling ${total.toLocaleString()}`}
        >
          {leaves.map((leaf, i) => {
            // d3-hierarchy types x0/y0/x1/y1 as optional on the base node; the treemap layout
            // above always populates them.
            const node = leaf as typeof leaf & { x0: number; x1: number; y0: number; y1: number };
            const w = node.x1 - node.x0;
            const h = node.y1 - node.y0;
            const label = leaf.data.name;
            const pct = total > 0 ? ((leaf.value ?? 0) / total) * 100 : 0;
            return (
              <g key={`${label}-${i}`} transform={`translate(${node.x0},${node.y0})`}>
                <title>{`${label}: ${(leaf.value ?? 0).toLocaleString()} (${pct.toFixed(1)}%)`}</title>
                <rect width={w} height={h} fill={colorAt(theme?.categorical_colors, i)} stroke="#fff" />
                {w > 54 && h > 22 && (
                  <text x={5} y={15} fontSize={11} fill="#fff" style={{ pointerEvents: "none" }}>
                    {label.length > Math.floor(w / 7) ? `${label.slice(0, Math.floor(w / 7))}…` : label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/**
 * Sunburst: d3-hierarchy `partition` in polar space. Each ring is a hierarchy level and a
 * segment's *angular sweep* is proportional to its value, so sibling comparison within a ring is
 * exact. Radius is uniform per level (it carries depth, not magnitude) -- the standard encoding.
 */
export function SunburstChart({ rows, levels, valueField, theme, title }: HierarchyChartProps) {
  const { ref, width, height } = useChartSize(360);
  const radius = Math.min(width, height) / 2;

  const nodes = useMemo(() => {
    const data = buildHierarchy(rows, levels, valueField);
    if (!data.children?.length || radius <= 0) return [];
    const h = hierarchy<HierarchyNode>(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    partition<HierarchyNode>().size([2 * Math.PI, radius])(h);
    return h.descendants().filter((d) => d.depth > 0);
  }, [rows, levels, valueField, radius]);

  const arcGenerator = d3arc<{ x0: number; x1: number; y0: number; y1: number }>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1)
    .padAngle(0.005);

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {nodes.length === 0 ? (
        <EmptyNotice message="Not enough hierarchical data to build a sunburst." />
      ) : (
        <svg width={width} height={height} role="img" aria-label={`${title ?? "Sunburst"}: ${nodes.length} segments`}>
          <g transform={`translate(${width / 2},${height / 2})`}>
            {nodes.map((node, i) => {
              const n = node as typeof node & { x0: number; x1: number; y0: number; y1: number };
              const path = arcGenerator({ x0: n.x0, x1: n.x1, y0: n.y0, y1: n.y1 }) ?? undefined;
              return (
                <path key={`${node.data.name}-${i}`} d={path} fill={colorAt(theme?.categorical_colors, i)} stroke="#fff" strokeWidth={0.5}>
                  <title>{`${node.ancestors().reverse().slice(1).map((a) => a.data.name).join(" › ")}: ${(node.value ?? 0).toLocaleString()}`}</title>
                </path>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

/**
 * Decomposition tree: a root metric broken down level by level, expandable one node at a time.
 * The decomposition itself is deterministic (sum of the measure within each dimension value);
 * only which branch is open is interactive state. No AI logic is involved in computing a branch.
 */
export function DecompositionTree({ rows, levels, valueField, theme, title }: HierarchyChartProps) {
  const data = useMemo(() => buildHierarchy(rows, levels, valueField), [rows, levels, valueField]);
  const rootTotal = useMemo(
    () => hierarchy<HierarchyNode>(data).sum((d) => d.value ?? 0).value ?? 0,
    [data]
  );

  if (!data.children?.length) {
    return <EmptyNotice message="Not enough data to build a decomposition tree." />;
  }

  return (
    <div className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <div className="rounded-[var(--radius-token)] border border-border bg-surface p-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{valueField}</span>
          <span className="font-headline text-2xl font-bold">{rootTotal.toLocaleString()}</span>
        </div>
        <TreeLevel nodes={data.children} parentTotal={rootTotal} depth={0} theme={theme} />
      </div>
    </div>
  );
}

function TreeLevel({
  nodes,
  parentTotal,
  depth,
  theme,
}: {
  nodes: HierarchyNode[];
  parentTotal: number;
  depth: number;
  theme?: ThemeTokens;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const withTotals = nodes
    .map((n) => ({
      node: n,
      total: hierarchy<HierarchyNode>(n).sum((d) => d.value ?? 0).value ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <ul className="flex flex-col gap-1" style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {withTotals.map(({ node, total }) => {
        const share = parentTotal > 0 ? (total / parentTotal) * 100 : 0;
        const hasChildren = !!node.children?.length;
        const isOpen = expanded === node.name;
        return (
          <li key={node.name}>
            <button
              type="button"
              disabled={!hasChildren}
              aria-expanded={hasChildren ? isOpen : undefined}
              onClick={() => setExpanded(isOpen ? null : node.name)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-token)] px-2 py-1 text-left text-sm hover:bg-surface-muted disabled:cursor-default"
            >
              <span className="w-4 shrink-0 text-muted-foreground">
                {hasChildren ? (isOpen ? "▾" : "▸") : ""}
              </span>
              <span className="w-32 shrink-0 truncate">{node.name}</span>
              <span
                className="h-2 shrink-0 rounded-sm"
                style={{
                  width: `${Math.max(share, 0.5)}%`,
                  backgroundColor: colorAt(theme?.categorical_colors, depth),
                }}
              />
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                {total.toLocaleString()} ({share.toFixed(1)}%)
              </span>
            </button>
            {isOpen && hasChildren && (
              <TreeLevel nodes={node.children!} parentTotal={total} depth={depth + 1} theme={theme} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
