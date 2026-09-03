# AiVis Visualization Library — 41-Type Verification Matrix

Audit of the full 41-type visualization library requirement against actual, running code.
Nothing in this document is claimed without evidence: registry entries, compiler code,
compatibility-engine tests, and a live render check (`/studio-preview`, all 41-mapped ids either
rendered a real Vega-Lite chart / real component, or the page showed zero errors for the 18 that
are implemented — no chart silently failed or showed a placeholder).

## Scope decision (stated up front, not hidden)

Full, mathematically/visually correct implementations of every one of the 41 types — including
force-directed network layouts, Sankey flow-width algorithms, true geographic projections with
region boundary data, KDE-based violin density, and trapezoid funnel/gauge-arc geometry — is
genuinely weeks of engineering work and requires libraries (`d3-force`, `d3-sankey`,
`d3-hierarchy`, `topojson`, a KDE implementation) that are not currently installed. Per the
audit's own Rule 61 ("a chart that technically renders but is mathematically/visually incorrect
is NOT implemented"), **nothing below was faked to inflate the pass count.** A chart type is
marked PASS only if it produces a correct, real rendering from real data; everything else is
marked BLOCKED with the specific missing dependency or schema gap named.

## Summary

```
Total visualizations required: 41
Implemented (PASS):            18
Verified (unit test + live render, zero errors): 18
Passing:                       18
Failing:                       0
Blocked (documented reason):   23
```

None of the 18 PASS entries are placeholders, mocks, or "coming soon" states — every one compiles
a real `VisualizationSpec` to a real Vega-Lite spec (or, for KPI/Table, a real React component
reading real row data) and was confirmed rendering with zero console/render errors this session,
after finding and fixing one real bug (`config.range: undefined` wiping Vega's built-in
color-scheme table, causing 4 of the 18 to silently error — see `aivis-verification-report.md`
if that one already exists, or the fix commit for detail).

## Verification Matrix

| # | Visualization | Renderer | Validation | AI Support | Preview | Studio | Export | Tests | Status |
| - | -------------- | -------- | ---------- | ---------- | ------- | ------ | ------ | ----- | ------ |
| 1 | Column Chart | ✅ vega-lite (`bar`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 2 | Stacked Column Chart | ✅ vega-lite (`stacked_bar`) | ✅ | 🟡 manual-studio only | ✅ | ✅ | ✅ | ✅ | PASS |
| 3 | Bar Chart | ✅ vega-lite (`horizontal_bar`, x/y swap) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 4 | Lollipop Chart | ❌ | — | — | — | — | — | — | BLOCKED: no D3 renderer built |
| 5 | Radar / Spider Chart | ❌ | — | — | — | — | — | — | BLOCKED: Vega-Lite has no polar coordinate system; needs custom D3 |
| 6 | Bullet Chart | ❌ | — | — | — | — | — | — | BLOCKED: needs custom D3 range-band + target-tick geometry |
| 7 | Line Chart | ✅ vega-lite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (pre-existing) | PASS |
| 8 | Area Chart | ✅ vega-lite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (pre-existing) | PASS |
| 9 | Sparkline Chart | ✅ vega-lite (axes hidden) | ✅ | 🟡 manual-studio only | ✅ | ✅ | ✅ | ✅ | PASS |
| 10 | Candlestick Chart | ❌ | — | — | — | — | — | — | BLOCKED: VisualizationSpec has no OHLC encoding; needs schema extension + D3/rule-layer geometry |
| 11 | Open-High-Low-Close Chart | ❌ | — | — | — | — | — | — | BLOCKED: same OHLC-encoding gap as candlestick (kept as a distinct entry per its distinct tick-mark geometry) |
| 12 | Ribbon Chart | ❌ | — | — | — | — | — | — | BLOCKED: needs custom D3 ribbon/stream layout |
| 13 | Bump Chart | ❌ | — | — | — | — | — | — | BLOCKED: needs a rank-transform (not in the transform layer) + D3 line-on-rank-axis layout |
| 14 | Sorted Bar Chart | ✅ vega-lite (explicit sort mode) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 15 | Line and Column Chart | ❌ | — | — | — | — | — | — | BLOCKED: VisualizationSpec has no second-measure/dual-axis encoding concept |
| 16 | Pie Chart | ✅ vega-lite (`arc`, innerRadius 0) | ✅ | 🟡 manual-studio only | ✅ | ✅ | ✅ | ✅ | PASS |
| 17 | Donut Chart | ✅ vega-lite (pre-existing) | ✅ | 🟡 manual-studio only | ✅ | ✅ | ✅ | ✅ (pre-existing) | PASS |
| 18 | Stacked Bar Chart | ✅ vega-lite (`stacked_bar_horizontal`) | ✅ | 🟡 manual-studio only | ✅ | ✅ | ✅ | ✅ | PASS |
| 19 | Treemap | ❌ | — | — | — | — | — | — | BLOCKED: needs d3-hierarchy's squarified-treemap algorithm |
| 20 | Sunburst Chart | ❌ | — | — | — | — | — | — | BLOCKED: needs d3-hierarchy + radial-partition layout |
| 21 | Waterfall Chart | ✅ vega-lite (real window-transform cumulative math) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 22 | Histogram | ✅ vega-lite (pre-existing) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (pre-existing) | PASS |
| 23 | Box and Whisker Plot | ✅ vega-lite (pre-existing) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (pre-existing) | PASS |
| 24 | Violin Plot | ❌ | — | — | — | — | — | — | BLOCKED: needs a real KDE implementation (no stats library installed; a fake/naive density estimate would violate the correctness rule) |
| 25 | Marimekko / Mosaic Chart | ❌ | — | — | — | — | — | — | BLOCKED: needs variable-width-column D3 layout (Vega-Lite bars are fixed-width) |
| 26 | Scatter Plot | ✅ vega-lite (pre-existing) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (pre-existing) | PASS |
| 27 | Bubble Chart | ✅ vega-lite (`point` + size, area-proportional) | ✅ | 🟡 manual-studio only | ✅ | ✅ | ✅ | ✅ | PASS |
| 28 | Heatmap / Matrix | ✅ vega-lite (`rect`) | ✅ | 🟡 manual-studio only | ✅ | ✅ | ✅ | ✅ | PASS |
| 29 | Network Diagram | ❌ | — | — | — | — | — | — | BLOCKED: needs d3-force for a controlled deterministic layout |
| 30 | Chord Diagram | ❌ | — | — | — | — | — | — | BLOCKED: needs d3-chord's proportional-arc algorithm |
| 31 | Funnel Chart | ❌ | — | — | — | — | — | — | BLOCKED: true funnel geometry is trapezoids, not bars -- Vega-Lite has no trapezoid mark; rendering as a bar chart would misrepresent the shape (Rule 61) |
| 32 | Gantt Chart | ❌ | — | — | — | — | — | — | BLOCKED: needs a start+end date-range (x/x2) encoding VisualizationSpec doesn't have |
| 33 | Sankey Diagram | ❌ | — | — | — | — | — | — | BLOCKED: needs d3-sankey's node-position + link-width algorithm; a naive layout would produce incorrect flow widths (explicitly a bug per the spec, not a partial implementation) |
| 34 | Decomposition Tree | ❌ | — | — | — | — | — | — | BLOCKED: needs interactive-expansion state + hierarchy layout + deterministic decomposition-path logic, none built |
| 35 | Choropleth / Filled Map | ❌ | — | — | — | — | — | — | BLOCKED: needs region-boundary geometry (topojson) + map projection library, not installed |
| 36 | Bubble Map Chart | ❌ | — | — | — | — | — | — | BLOCKED: same map-base-layer dependency gap as choropleth |
| 37 | Flow Map | ❌ | — | — | — | — | — | — | BLOCKED: same map-base-layer gap, plus great-circle path geometry |
| 38 | KPI Card | ✅ component (`KPICard`, real aggregation + real period-over-period comparison) | ✅ | 🟡 manual-studio only | ✅ | ✅ | 🟡 not wired to SVG/PNG export path (component, not Vega view) | ✅ | PASS |
| 39 | Gauge | ❌ | — | — | — | — | — | — | BLOCKED: needs a D3 arc component + min/max/target encoding VisualizationSpec doesn't have |
| 40 | Data Table | ✅ component (`DataTable`, real sort/pagination over real rows) | ✅ | 🟡 manual-studio only | ✅ | ✅ | 🟡 not wired to SVG/PNG export path (component, not Vega view) | ✅ | PASS |
| 41 | Matrix | ❌ | — | — | — | — | — | — | BLOCKED: needs pivot/cross-tab computation + subtotal logic not in the transform layer; distinct from heatmap (display-only, no pivoting) |

**AI Support legend**: ✅ = the deterministic recommendation engine can automatically surface this
chart type for a compatible 2-field Story (bar/line/area/histogram/box_plot/scatter/sorted_bar/
horizontal_bar/waterfall/sparkline/donut/pie already worked or were added this session). 🟡 =
chart type requires 3 encodings (color/size) that the current 1-2-field deterministic Story
pipeline can't supply automatically — still fully selectable and functional via manual studio
field-mapping, and still exposed to Gemini in `AnalyticalFinding.suggested_chart_type` for the
2-field cases where it applies (stacked_bar/bubble/heatmap are excluded from Gemini's suggestion
list since a 2-field finding can't complete their 3-encoding requirement either).

**Export caveat (KPI/Table)**: the existing SVG/PNG export path (`app/lib/visualization/export.ts`)
captures the Vega `View` instance's own `toSVG()`/`toImageURL()` — KPI/Table aren't Vega views (a
KPI card is a `<div>`, a table is an HTML `<table>`), so they render correctly everywhere
(preview/studio) but aren't wired into that specific export mechanism yet. Flagged, not hidden.

## Architecture (section 2/46/52 requirements)

- **Registry, not a giant conditional**: `frontend/src/lib/visualization/registry.ts` +
  `backend/app/visualization/registry.py` — 42 entries (the 41 required + `grouped_bar`, a
  pre-existing bonus type), each with id/label/category/subcategory/description/required and
  optional encodings/supported field types/min data points/max cardinality/supported
  aggregations/temporal-geographic-hierarchical-relational-OHLC flags/renderer engine/
  `implemented` flag/`blockedReason` where applicable.
- **Compatibility engine**: `backend/app/visualization/validation.py::REQUIRED_ENCODINGS` +
  `validate_spec()` — every implemented chart type's required encoding channels are checked
  before a spec can be considered valid (a heatmap without `color`, a bubble without `size`, a
  KPI without a measure are all rejected with a specific error, not silently rendered wrong).
  7 new unit tests (`tests/unit/test_chart_compatibility_engine.py`) cover this directly.
- **Canonical VisualizationSpec unchanged**: every implemented chart type — including the 8 new
  ones — resolves through the exact same `VisualizationSpec` → `compileToVegaLite` →
  `VisualizationRenderer` → preview/studio/export path as the original 8. No parallel data format
  was introduced. The 23 blocked types would each need a real schema extension (OHLC fields,
  date-range x/x2, dual-measure) or a new renderer dispatch (`d3`/`map`), not a rewrite of the
  spec itself.
- **AI context**: `app/services/ai_findings.py::_SUPPORTED_CHART_TYPES` is now generated directly
  from `IMPLEMENTED_CHART_TYPES` (not a hand-maintained duplicate list) — Gemini is told about
  exactly the chart types that actually render, and only those; a hallucinated or unimplemented
  chart type is still rejected by `validate_spec()` even if Gemini ignores the prompt constraint.

## Testing

- Backend: `tests/unit/test_chart_compatibility_engine.py` (7), `tests/unit/test_recommendation_new_chart_types.py` (4) — 11 new tests, all passing.
- Frontend: `tests/lib/visualization/__tests__/to-vega-lite.test.ts` gained 9 new tests (horizontal-orientation x/y swap, sort direction both ways, waterfall's exact window-transform shape, pie vs donut innerRadius, heatmap rect+color, bubble size, sparkline axis-hiding). `components/visualization/__tests__/kpi-card.test.tsx` (5 new) covers real sum/mean aggregation and real period-over-period comparison from actual row data, plus the "never fabricate a comparison" case.
- Live: `/studio-preview` extended with all 12 new/changed chart specs — confirmed zero render errors after finding and fixing a real bug (`config.range: undefined` wiping Vega's built-in named-range table for any chart with a color encoding and no theme).
- Full suite after this work: backend 125/125, frontend 30/30 (`tsc`, `eslint`, `next build` all clean).

## What would close the remaining 23

Roughly three dependency-gap clusters, not 23 independent problems:
1. **D3 layout algorithms** (lollipop, radar, bullet, ribbon, bump, treemap, sunburst, violin,
   marimekko, network, chord, funnel, decomposition_tree, gauge — 14 types): needs `d3-hierarchy`,
   `d3-force`, `d3-chord`, and a KDE implementation added as real dependencies, plus per-type
   layout code. `d3` itself is already a project dependency but isn't wired into the render path.
2. **VisualizationSpec schema extensions** (candlestick, OHLC, line_column, gantt — 4 types): each
   needs a genuinely new encoding concept (OHLC fields, dual-measure, date-range x/x2) added to
   the canonical spec and mirrored on both sides, not just a new mark type.
3. **Geo mapping stack** (choropleth, bubble_map, flow_map — 3 types): needs a topojson dependency
   and region-boundary data, not currently installed.
4. **Flow-specific algorithms** (sankey, matrix — 2 types): sankey needs `d3-sankey`; matrix needs
   pivot/cross-tab + subtotal logic in the transform layer.
