import { CHART_REGISTRY, type ChartCategory, type ChartTypeDefinition } from "@/lib/visualization/registry";

/** Human-readable labels for the registry's real ChartCategory values -- not an invented
 * taxonomy. The registry (mirrored exactly from backend/app/visualization/registry.py) is the
 * single source of truth for which categories exist; this only supplies display copy. */
export const CATEGORY_LABELS: Record<ChartCategory, string> = {
  comparison: "Comparison",
  temporal: "Temporal",
  distribution: "Distribution",
  relationship: "Relationship",
  part_to_whole: "Part-to-Whole",
  geographic: "Geographic",
  hierarchical: "Hierarchical",
  specialized: "Specialized",
  single_metric: "Single Metric",
  raw_data: "Raw Data",
  flow: "Flow",
};

const CATEGORY_ORDER: ChartCategory[] = [
  "comparison",
  "temporal",
  "distribution",
  "relationship",
  "part_to_whole",
  "hierarchical",
  "flow",
  "geographic",
  "single_metric",
  "raw_data",
  "specialized",
];

export function categoriesWithCounts(): { category: ChartCategory; label: string; count: number }[] {
  const counts = new Map<ChartCategory, number>();
  for (const def of CHART_REGISTRY) {
    counts.set(def.category, (counts.get(def.category) ?? 0) + 1);
  }
  return CATEGORY_ORDER.filter((category) => counts.has(category)).map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    count: counts.get(category) ?? 0,
  }));
}

export function chartsInCategory(category: ChartCategory): ChartTypeDefinition[] {
  return CHART_REGISTRY.filter((def) => def.category === category);
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  categorical: "categorical",
  numeric: "numeric",
  currency: "numeric",
  date: "date",
  text: "text",
  boolean: "boolean",
  geographic: "geographic",
  identifier: "identifier",
};

/** Deterministic "Needs: ..." copy derived from requiredEncodings + supportedFieldTypes -- no
 * second hand-maintained compatibility map, and no invented requirements. */
export function compatibilityDescription(def: ChartTypeDefinition): string {
  const types = Array.from(
    new Set(def.supportedFieldTypes.map((t) => FIELD_TYPE_LABELS[t] ?? t))
  );
  const channelCount = def.requiredEncodings.length;
  if (channelCount === 0) return "No specific field requirements.";
  const namedChannels = def.requiredEncodings.filter((c) =>
    ["open", "high", "low", "close"].includes(c)
  );
  if (namedChannels.length > 0) {
    return `Needs: ${def.requiredEncodings.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}`;
  }
  return `Needs: ${channelCount} field${channelCount === 1 ? "" : "s"} (${types.join(" or ")})`;
}
