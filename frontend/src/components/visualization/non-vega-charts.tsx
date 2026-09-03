"use client";

import { DataTable } from "@/components/visualization/data-table";
import { KPICard } from "@/components/visualization/kpi-card";
import { MatrixView } from "@/components/visualization/matrix-view";
import {
  DecompositionTree,
  SunburstChart,
  TreemapChart,
} from "@/components/visualization/d3/hierarchy-charts";
import {
  ChordChart,
  NetworkChart,
  SankeyChart,
} from "@/components/visualization/d3/relational-charts";
import {
  FunnelChart,
  GaugeChart,
  RadarChart,
  ViolinChart,
} from "@/components/visualization/d3/stat-charts";
import {
  BubbleMapChart,
  ChoroplethChart,
  FlowMapChart,
} from "@/components/visualization/d3/geo-charts";
import type { ThemeTokens } from "@/lib/api/theme";
import type { VisualizationSpec } from "@/lib/visualization/spec";

/**
 * Dispatch for chart types that aren't Vega-Lite specs -- D3-rendered SVG and React components.
 *
 * Each entry reads the fields it needs from the canonical VisualizationSpec's encoding channels
 * (the spec is still the single source of truth; these renderers just interpret it differently
 * from the Vega-Lite compiler). Returning `null` means "not a non-Vega chart type", which tells
 * VisualizationRenderer to fall through to the Vega-Lite path.
 */
export function renderNonVegaChart(
  spec: VisualizationSpec,
  rows: Record<string, unknown>[],
  theme?: ThemeTokens
): React.ReactElement | null {
  const e = spec.encoding;
  const title = spec.typography.title;

  const missing = (what: string) => (
    <div role="alert" className="rounded-[var(--radius-token)] border border-negative/30 bg-accent-muted p-4 text-sm text-negative">
      {`This ${spec.chart_type} chart needs ${what}.`}
    </div>
  );

  switch (spec.chart_type) {
    case "kpi":
      return <KPICard spec={spec} rows={rows} />;
    case "table":
      return <DataTable rows={rows} title={title} />;

    case "matrix":
      if (!e.x?.field || !e.y?.field || !e.size?.field) return missing("row, column and value fields");
      return (
        <MatrixView
          rows={rows}
          rowField={e.y.field}
          columnField={e.x.field}
          valueField={e.size.field}
          aggregation={e.size.aggregation}
          title={title}
        />
      );

    // --- Hierarchy: `detail` carries the outer grouping level, `color` an optional inner one ---
    case "treemap":
    case "sunburst":
    case "decomposition_tree": {
      if (!e.detail?.field || !e.size?.field) return missing("a grouping field and a value field");
      const levels = [e.detail.field, ...(e.color?.field ? [e.color.field] : [])];
      const props = { rows, levels, valueField: e.size.field, theme, title };
      if (spec.chart_type === "treemap") return <TreemapChart {...props} />;
      if (spec.chart_type === "sunburst") return <SunburstChart {...props} />;
      return <DecompositionTree {...props} />;
    }

    // --- Relational: x=source, y=target, size=weight ---
    case "network":
    case "chord":
    case "sankey": {
      if (!e.x?.field || !e.y?.field || !e.size?.field) return missing("source, target and value fields");
      const props = {
        rows,
        sourceField: e.x.field,
        targetField: e.y.field,
        valueField: e.size.field,
        theme,
        title,
      };
      if (spec.chart_type === "network") return <NetworkChart {...props} />;
      if (spec.chart_type === "chord") return <ChordChart {...props} />;
      return <SankeyChart {...props} />;
    }

    case "violin":
      if (!e.x?.field || !e.y?.field) return missing("a category field and a numeric field");
      return (
        <ViolinChart rows={rows} categoryField={e.x.field} valueField={e.y.field} theme={theme} title={title} />
      );

    case "funnel":
      if (!e.x?.field || !e.y?.field) return missing("a stage field and a value field");
      return (
        <FunnelChart rows={rows} categoryField={e.x.field} valueField={e.y.field} theme={theme} title={title} />
      );

    case "radar":
      if (!e.x?.field || !e.y?.field || !e.color?.field) return missing("metric, value and series fields");
      return (
        <RadarChart
          rows={rows}
          metricField={e.x.field}
          valueField={e.y.field}
          seriesField={e.color.field}
          theme={theme}
          title={title}
        />
      );

    case "gauge": {
      if (!e.size?.field) return missing("a numeric measure");
      const field = e.size.field;
      const values = rows.map((r) => Number(r[field])).filter(Number.isFinite);
      if (values.length === 0) return missing("at least one numeric value");
      const aggregation = e.size.aggregation ?? "sum";
      const value =
        aggregation === "mean"
          ? values.reduce((a, b) => a + b, 0) / values.length
          : aggregation === "max"
            ? Math.max(...values)
            : aggregation === "min"
              ? Math.min(...values)
              : aggregation === "count"
                ? values.length
                : values.reduce((a, b) => a + b, 0);
      // Bounds come from the observed data unless a target measure supplies an explicit ceiling.
      const targetValues = e.measure2?.field
        ? rows.map((r) => Number(r[e.measure2!.field])).filter(Number.isFinite)
        : [];
      const target = targetValues.length > 0 ? targetValues[0] : null;
      return (
        <GaugeChart
          value={value}
          min={0}
          max={Math.max(value, target ?? 0, ...values)}
          target={target}
          label={title ?? field}
          theme={theme}
        />
      );
    }

    case "choropleth":
      if (!e.x?.field || !e.color?.field) return missing("a region field and a value field");
      return (
        <ChoroplethChart rows={rows} regionField={e.x.field} valueField={e.color.field} theme={theme} title={title} />
      );

    case "bubble_map":
      if (!e.y?.field || !e.x?.field || !e.size?.field) return missing("latitude, longitude and size fields");
      return (
        <BubbleMapChart
          rows={rows}
          latField={e.y.field}
          lonField={e.x.field}
          sizeField={e.size.field}
          theme={theme}
          title={title}
        />
      );

    case "flow_map":
      if (!e.x?.field || !e.y?.field || !e.x2?.field || !e.y2?.field || !e.size?.field)
        return missing("origin lon/lat, destination lon/lat and a value field");
      return (
        <FlowMapChart
          rows={rows}
          originLonField={e.x.field}
          originLatField={e.y.field}
          destLonField={e.x2.field}
          destLatField={e.y2.field}
          valueField={e.size.field}
          theme={theme}
          title={title}
        />
      );

    default:
      return null;
  }
}
