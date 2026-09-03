"use client";

import { chord as d3chord, ribbon as d3ribbon } from "d3-chord";
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { sankey as d3sankey, sankeyLinkHorizontal } from "d3-sankey";
import { arc as d3arc } from "d3-shape";
import { useMemo } from "react";

import type { ThemeTokens } from "@/lib/api/theme";
import { buildGraph, removeCycles, type Graph } from "@/lib/visualization/d3-data";
import { colorAt, useChartSize } from "./use-chart-size";

interface RelationalChartProps {
  rows: Record<string, unknown>[];
  sourceField: string;
  targetField: string;
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

type SimNode = SimulationNodeDatum & { id: string; value: number };
type SimLink = SimulationLinkDatum<SimNode> & { value: number };

/**
 * Force-directed network via d3-force. The simulation is run to completion synchronously with a
 * fixed tick count and no randomised initial positions beyond d3's own deterministic phyllotaxis
 * seeding, so the same data always produces the same layout -- a requirement for a chart that
 * gets exported and compared. Node radius encodes total incident weight by *area*.
 */
export function NetworkChart({ rows, sourceField, targetField, valueField, theme, title }: RelationalChartProps) {
  const { ref, width, height } = useChartSize(400);

  const layout = useMemo(() => {
    const graph = buildGraph(rows, sourceField, targetField, valueField);
    if (graph.nodes.length === 0 || width === 0) return null;

    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = graph.links.map((l) => ({ ...l }));

    const simulation = forceSimulation(nodes)
      .force("link", forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(70))
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(width / 2, height / 2))
      .stop();
    // Run deterministically to convergence instead of animating -- identical output every run.
    simulation.tick(300);

    return { nodes, links };
  }, [rows, sourceField, targetField, valueField, width, height]);

  const maxValue = Math.max(1, ...(layout?.nodes.map((n) => n.value) ?? [1]));
  const maxLink = Math.max(1, ...(layout?.links.map((l) => l.value) ?? [1]));

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {!layout ? (
        <EmptyNotice message="No source/target relationships found to build a network." />
      ) : (
        <svg width={width} height={height} role="img" aria-label={`${title ?? "Network"}: ${layout.nodes.length} nodes, ${layout.links.length} links`}>
          <g>
            {layout.links.map((link, i) => {
              const s = link.source as SimNode;
              const t = link.target as SimNode;
              return (
                <line
                  key={i}
                  x1={s.x ?? 0}
                  y1={s.y ?? 0}
                  x2={t.x ?? 0}
                  y2={t.y ?? 0}
                  stroke={theme?.border ?? "#999"}
                  strokeOpacity={0.6}
                  strokeWidth={0.5 + (link.value / maxLink) * 4}
                >
                  <title>{`${s.id} → ${t.id}: ${link.value.toLocaleString()}`}</title>
                </line>
              );
            })}
          </g>
          <g>
            {layout.nodes.map((node, i) => {
              // Area-proportional: r = sqrt(value/max) so magnitude reads linearly by area.
              const r = 4 + Math.sqrt(node.value / maxValue) * 14;
              return (
                <circle key={node.id} cx={node.x ?? 0} cy={node.y ?? 0} r={r} fill={colorAt(theme?.categorical_colors, i)} stroke="#fff" strokeWidth={1.5}>
                  <title>{`${node.id}: ${node.value.toLocaleString()}`}</title>
                </circle>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

/**
 * Chord diagram via d3-chord. Builds a square weighted adjacency matrix from the flows, so each
 * arc's angular extent is exactly that entity's share of total flow and each ribbon's endpoints
 * are proportional to the directed weights -- d3-chord's own layout, not an approximation.
 */
export function ChordChart({ rows, sourceField, targetField, valueField, theme, title }: RelationalChartProps) {
  const { ref, width, height } = useChartSize(400);
  const size = Math.min(width, height);
  const outerRadius = size / 2 - 24;
  const innerRadius = outerRadius - 14;

  const model = useMemo(() => {
    const graph: Graph = buildGraph(rows, sourceField, targetField, valueField);
    const names = graph.nodes.map((n) => n.id);
    if (names.length < 2 || outerRadius <= 0) return null;

    const index = new Map(names.map((n, i) => [n, i]));
    const matrix = names.map(() => new Array(names.length).fill(0));
    for (const link of graph.links) {
      const s = index.get(link.source);
      const t = index.get(link.target);
      if (s === undefined || t === undefined) continue;
      matrix[s][t] += link.value;
    }
    return { names, chords: d3chord().padAngle(0.04)(matrix) };
  }, [rows, sourceField, targetField, valueField, outerRadius]);

  const arcGenerator = d3arc().innerRadius(innerRadius).outerRadius(outerRadius);
  const ribbonGenerator = d3ribbon().radius(innerRadius);

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {!model ? (
        <EmptyNotice message="Need at least two related entities to build a chord diagram." />
      ) : (
        <svg width={width} height={height} role="img" aria-label={`${title ?? "Chord diagram"}: ${model.names.length} entities`}>
          <g transform={`translate(${width / 2},${height / 2})`}>
            {model.chords.groups.map((group, i) => (
              <g key={i}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <path d={arcGenerator(group as any) ?? undefined} fill={colorAt(theme?.categorical_colors, i)} stroke="#fff">
                  <title>{`${model.names[i]}: ${group.value.toLocaleString()}`}</title>
                </path>
                <text
                  transform={`rotate(${((group.startAngle + group.endAngle) / 2) * (180 / Math.PI) - 90}) translate(${outerRadius + 6}) ${(group.startAngle + group.endAngle) / 2 > Math.PI ? "rotate(180)" : ""}`}
                  textAnchor={(group.startAngle + group.endAngle) / 2 > Math.PI ? "end" : "start"}
                  fontSize={10}
                  fill={theme?.foreground ?? "#333"}
                >
                  {model.names[i]}
                </text>
              </g>
            ))}
            {model.chords.map((chord, i) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <path key={i} d={ribbonGenerator(chord as any) ?? undefined} fill={colorAt(theme?.categorical_colors, chord.source.index)} fillOpacity={0.65} stroke="#fff" strokeWidth={0.4}>
                <title>{`${model.names[chord.source.index]} → ${model.names[chord.target.index]}: ${chord.source.value.toLocaleString()}`}</title>
              </path>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

type SankeyNodeExtra = { id: string; value: number };
type SankeyLinkExtra = { value: number };

/**
 * Sankey via d3-sankey -- the real layout algorithm, so link thickness is exactly proportional
 * to flow value and node positions come from genuine depth assignment plus iterative crossing
 * minimisation. Cycles are removed first (reported in the caption) because the algorithm
 * requires a DAG; silently feeding it a cycle produces a corrupted layout rather than an error.
 */
export function SankeyChart({ rows, sourceField, targetField, valueField, theme, title }: RelationalChartProps) {
  const { ref, width, height } = useChartSize(400);

  const model = useMemo(() => {
    const raw = buildGraph(rows, sourceField, targetField, valueField);
    if (raw.nodes.length < 2 || raw.links.length === 0 || width === 0) return null;
    const { graph, removed } = removeCycles(raw);
    if (graph.links.length === 0) return null;

    const layout = d3sankey<SankeyNodeExtra, SankeyLinkExtra>()
      .nodeId((d) => d.id)
      .nodeWidth(14)
      .nodePadding(12)
      .extent([
        [1, 6],
        [width - 1, height - 6],
      ]);

    return {
      ...layout({
        nodes: graph.nodes.map((n) => ({ ...n })),
        links: graph.links.map((l) => ({ ...l })),
      }),
      removedCount: removed.length,
    };
  }, [rows, sourceField, targetField, valueField, width, height]);

  const pathGenerator = sankeyLinkHorizontal();

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {!model ? (
        <EmptyNotice message="Need a directed source → target flow with values to build a Sankey diagram." />
      ) : (
        <>
          <svg width={width} height={height} role="img" aria-label={`${title ?? "Sankey diagram"}: ${model.nodes.length} nodes, ${model.links.length} flows`}>
            <g fill="none">
              {model.links.map((link, i) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <path key={i} d={pathGenerator(link as any) ?? undefined} stroke={colorAt(theme?.categorical_colors, i)} strokeOpacity={0.45} strokeWidth={Math.max(1, link.width ?? 1)}>
                  <title>{`${(link.source as SankeyNodeExtra).id} → ${(link.target as SankeyNodeExtra).id}: ${link.value.toLocaleString()}`}</title>
                </path>
              ))}
            </g>
            <g>
              {model.nodes.map((node, i) => (
                <g key={node.id}>
                  <rect
                    x={node.x0 ?? 0}
                    y={node.y0 ?? 0}
                    width={(node.x1 ?? 0) - (node.x0 ?? 0)}
                    height={Math.max(1, (node.y1 ?? 0) - (node.y0 ?? 0))}
                    fill={colorAt(theme?.categorical_colors, i)}
                  >
                    <title>{`${node.id}: ${(node.value ?? 0).toLocaleString()}`}</title>
                  </rect>
                  <text
                    x={(node.x0 ?? 0) < width / 2 ? (node.x1 ?? 0) + 5 : (node.x0 ?? 0) - 5}
                    y={((node.y0 ?? 0) + (node.y1 ?? 0)) / 2}
                    dy="0.35em"
                    textAnchor={(node.x0 ?? 0) < width / 2 ? "start" : "end"}
                    fontSize={10}
                    fill={theme?.foreground ?? "#333"}
                  >
                    {node.id}
                  </text>
                </g>
              ))}
            </g>
          </svg>
          {model.removedCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {model.removedCount} cyclic link{model.removedCount === 1 ? "" : "s"} omitted — a Sankey
              requires an acyclic flow.
            </p>
          )}
        </>
      )}
    </div>
  );
}
