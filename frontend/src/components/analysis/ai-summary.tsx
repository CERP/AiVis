import type { VisualizationRecommendation } from "@/lib/api/types";

/** Deterministic composition from already-computed finding descriptions -- never an extra
 * Gemini call, and never invented prose. Each sentence used here is verbatim backend-produced
 * text (VisualizationRecommendation.description, "the underlying insight's supporting stat" per
 * its own docstring), just joined into a short opening paragraph. Renders nothing when there's
 * no real content to summarize, rather than fabricating a generic sentence. */
export function AISummary({ findings }: { findings: VisualizationRecommendation[] }) {
  const sentences = findings
    .slice(0, 2)
    .map((f) => f.description.trim())
    .filter(Boolean);

  if (sentences.length === 0) return null;

  return <p className="max-w-[720px] text-[15px] leading-relaxed text-foreground">{sentences.join(" ")}</p>;
}
