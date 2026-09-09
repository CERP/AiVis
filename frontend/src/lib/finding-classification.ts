export type FindingKind = "insight" | "exploration";

/** Backend recommendations (see app/visualization/recommendation.py) are ALL declarative by
 * design -- the model's own docstring states "no narrative question framing." There is no
 * backend field marking a recommendation as an open question vs. a closed finding, and forcing
 * titles into invented question grammar would fabricate content the pipeline never produced.
 *
 * The one real, existing, non-color signal available is `category` (trend/comparison/ranking/
 * composition/change/seasonality/anomaly are backend-computed CONCLUSIONS -- "X changed," "X
 * ranks higher"; relationship/distribution/derived_metric/other surface something worth
 * investigating further rather than a closed conclusion). This is a genuine, deterministic
 * property of already-existing data, not an invented classification -- but it means Exploration
 * findings keep their real (declarative) headline text rather than being rewritten as a
 * question. The label + glyph are the two signals actually used; grammar is not, because the
 * backend never produced question-phrased content to reflect grammatically. */
const CONCLUSION_CATEGORIES = new Set([
  "trend",
  "comparison",
  "ranking",
  "composition",
  "change",
  "seasonality",
  "anomaly",
]);

export function classifyFinding(category: string): FindingKind {
  return CONCLUSION_CATEGORIES.has(category) ? "insight" : "exploration";
}
