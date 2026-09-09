import type { ChartTypeDefinition, EncodingChannel } from "@/lib/visualization/registry";
import type { Encoding, EncodingType, Encodings } from "@/lib/visualization/spec";
import type { ColumnProfile } from "@/lib/api/insights";

const QUANTITATIVE_TYPES = new Set(["numeric", "currency"]);

function encodingTypeFor(semanticType: string | null): EncodingType {
  if (semanticType === "date") return "temporal";
  if (semanticType && QUANTITATIVE_TYPES.has(semanticType)) return "quantitative";
  return "nominal";
}

/** Per-channel preferred semantic types, tried in order until a real, unused column matches.
 * This is a best-effort heuristic, not a guarantee of an analytically meaningful chart -- Studio
 * (opened immediately after) is where the user corrects the mapping, exactly like a
 * recommendation-created visualization is refined there too. Channel identity alone implies a
 * reasonable type most of the time (color/detail group by category, size/measure2/OHLC channels
 * are measures); requiresTemporal/requiresGeographic push x/color toward those types first. */
function preferredTypesFor(channel: EncodingChannel, def: ChartTypeDefinition): string[] {
  switch (channel) {
    case "x":
      if (def.requiresTemporal) return ["date", "categorical", "text", "numeric"];
      if (def.requiresGeographic) return ["geographic", "categorical", "numeric"];
      return ["categorical", "text", "identifier", "numeric", "date"];
    case "y":
    case "y2":
    case "size":
    case "measure2":
    case "open":
    case "high":
    case "low":
    case "close":
      return ["numeric", "currency"];
    case "x2":
      return ["date", "numeric", "currency"];
    case "color":
      if (def.requiresGeographic) return ["geographic", "categorical"];
      return ["categorical", "text", "boolean", "identifier"];
    case "detail":
      return ["categorical", "text", "identifier"];
    default:
      return ["categorical", "numeric"];
  }
}

function findColumn(
  columns: ColumnProfile[],
  preferredTypes: string[],
  used: Set<string>
): ColumnProfile | null {
  for (const type of preferredTypes) {
    const match = columns.find((c) => !used.has(c.name) && c.semantic_type === type);
    if (match) return match;
  }
  // Fall back to any unused column at all rather than failing outright -- still real data,
  // just not the ideally-typed column for this channel.
  return columns.find((c) => !used.has(c.name)) ?? null;
}

/** Builds the smallest valid starting encoding for a chart type from a dataset's real columns.
 * Returns null if the dataset genuinely doesn't have enough distinct columns to satisfy every
 * required channel -- callers should show that as "this chart isn't compatible with this
 * dataset" rather than send a spec that backend validation will reject anyway. */
export function buildDraftEncoding(
  def: ChartTypeDefinition,
  columns: ColumnProfile[]
): Encodings | null {
  const encoding: Encodings = {};
  const used = new Set<string>();

  for (const channel of def.requiredEncodings) {
    const column = findColumn(columns, preferredTypesFor(channel, def), used);
    if (!column) return null;
    used.add(column.name);
    const entry: Encoding = { field: column.name, type: encodingTypeFor(column.semantic_type) };
    encoding[channel] = entry;
  }

  return encoding;
}
