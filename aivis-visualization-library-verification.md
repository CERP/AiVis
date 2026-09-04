# AiVis Visualization Library — 41-Type Verification Matrix

Audit of the full 41-type visualization library against actual, running code. Every row is
backed by a registry entry, a real renderer, compatibility-engine enforcement, and a **live
render check**: `/chart-gallery` draws all 42 registry entries (41 required + `grouped_bar`)
from fixture data appropriate to each type.

## Summary

```
Total visualizations required: 41
Implemented:                   41
Verified (live render):        41
Passing:                       41
Failing:                       0
Blocked:                       0
```

Live verification result from `/chart-gallery` (DOM-inspected, not eyeballed):

```
cardCount:  42     (41 required + grouped_bar)
svgCount:   48
tableCount:  2     (Data Table, Matrix)
errorCount:  0     ← no placeholder, "unsupported", or error state on any card
```

### Correction to the previous version of this document

An earlier revision listed 23 types as BLOCKED on missing dependencies. That was **wrong on the
facts**: `d3` v7 is a bundle that already ships `d3-hierarchy`, `d3-force`, `d3-chord`,
`d3-geo`, `d3-geo-projection` and `d3-shape`, and `topojson-client` was already present as a
transitive dependency. Only `d3-sankey` and map boundary data (`world-atlas`) were genuinely
missing; both are now installed. Nothing was blocked by a real capability gap.

## Verification Matrix

| # | Visualization | Renderer | Validation | AI Support | Preview | Studio | Export | Tests | Status |
| - | -------------- | -------- | ---------- | ---------- | ------- | ------ | ------ | ----- | ------ |
| 1 | Column Chart | ✅ vega-lite `bar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 2 | Stacked Column Chart | ✅ vega-lite `stacked_bar` | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 3 | Bar Chart | ✅ vega-lite `horizontal_bar` (x/y swap) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 4 | Lollipop Chart | ✅ vega-lite layer (rule→0 + point) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 5 | Radar / Spider Chart | ✅ d3 polar, per-axis normalisation | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 6 | Bullet Chart | ✅ vega-lite layer + `joinaggregate` range | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 7 | Line Chart | ✅ vega-lite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 8 | Area Chart | ✅ vega-lite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 9 | Sparkline Chart | ✅ vega-lite, axes suppressed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 10 | Candlestick Chart | ✅ vega-lite layer (rule wick + body bar) | ✅ OHLC group | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 11 | Open-High-Low-Close Chart | ✅ vega-lite layer (rule + offset ticks) | ✅ OHLC group | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 12 | Ribbon Chart | ✅ vega-lite stacked area, value-ordered | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 13 | Bump Chart | ✅ vega-lite `window: rank` + reversed scale | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 14 | Sorted Bar Chart | ✅ vega-lite explicit sort mode | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 15 | Line and Column Chart | ✅ vega-lite layer, independent y scales | ✅ `measure2` | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 16 | Pie Chart | ✅ vega-lite `arc`, innerRadius 0 | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 17 | Donut Chart | ✅ vega-lite `arc`, innerRadius 60 | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 18 | Stacked Bar Chart | ✅ vega-lite `stacked_bar_horizontal` | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 19 | Treemap | ✅ d3-hierarchy squarified tiling | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 20 | Sunburst Chart | ✅ d3-hierarchy partition + arc | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 21 | Waterfall Chart | ✅ vega-lite `window` running total | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 22 | Histogram | ✅ vega-lite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 23 | Box and Whisker Plot | ✅ vega-lite `boxplot` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 24 | Violin Plot | ✅ d3 + real Gaussian KDE (Silverman) | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 25 | Marimekko / Mosaic Chart | ✅ computed cell rects, x/x2 + y/y2 | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 26 | Scatter Plot | ✅ vega-lite `point` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 27 | Bubble Chart | ✅ vega-lite `point` + size (area) | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 28 | Heatmap / Matrix | ✅ vega-lite `rect` | ✅ | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 29 | Network Diagram | ✅ d3-force, deterministic 300-tick run | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 30 | Chord Diagram | ✅ d3-chord on weighted adjacency matrix | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 31 | Funnel Chart | ✅ d3 real trapezoid paths + conversion % | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 32 | Gantt Chart | ✅ vega-lite bar with x/x2 date range | ✅ `x2` | 🟡 studio | ✅ | ✅ | ✅ | ✅ | PASS |
| 33 | Sankey Diagram | ✅ d3-sankey + cycle removal | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 34 | Decomposition Tree | ✅ d3-hierarchy, interactive expand | ✅ | 🟡 studio | ✅ | ✅ | 🟡 DOM | ✅ | PASS |
| 35 | Choropleth / Filled Map | ✅ d3-geo + Natural Earth 110m topojson | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 36 | Bubble Map Chart | ✅ d3-geo projection, area-proportional | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 37 | Flow Map | ✅ d3-geo `geoInterpolate` great circles | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 38 | KPI Card | ✅ component, real aggregation + PoP delta | ✅ | 🟡 studio | ✅ | ✅ | 🟡 DOM | ✅ | PASS |
| 39 | Gauge | ✅ d3-shape arc, bands + target needle | ✅ | 🟡 studio | ✅ | ✅ | 🟡 SVG-only | ✅ | PASS |
| 40 | Data Table | ✅ component, sort + pagination | ✅ | 🟡 studio | ✅ | ✅ | 🟡 DOM | ✅ | PASS |
| 41 | Matrix | ✅ component, real pivot + subtotals | ✅ | 🟡 studio | ✅ | ✅ | 🟡 DOM | ✅ | PASS |

*(`grouped_bar` is a 42nd registry entry that predates this list — also implemented and rendering.)*

**AI Support legend.** ✅ = the deterministic recommendation engine auto-generates this type from
a 2-field Story. 🟡 studio = requires 3+ encodings (or specialised channels like OHLC/x2) that a
2-field Story can't supply, so it's fully available via manual studio field-mapping and is
excluded from Gemini's suggestion list rather than being offered and then rejected. Every type is
registry-declared, so Gemini is never told about a chart that isn't renderable.

**Export legend.** ✅ = flows through the Vega `View.toSVG()/toImageURL()` export path. 🟡 SVG-only
/ DOM = the chart is real SVG or DOM but isn't a Vega view, so the existing Vega-based export
button doesn't capture it. **This is a genuine remaining gap**, not a rendering problem — the fix
is a DOM/SVG serialiser export path, tracked as follow-up work.

## Correctness notes (Rule 61 — "renders" is not "implemented")

Each of these was implemented to be mathematically right, not merely to produce a picture:

- **Waterfall** — Vega-Lite `window` running sum with `frame: [null, 0]`; each bar spans
  `start`→`cumulative`, so positioning is correct regardless of row order.
- **Bump** — `window: [{op: "rank"}]` partitioned by period, sorted by measure: true competitive
  rank per period, not the raw measure relabelled.
- **Marimekko** — cell rectangles computed explicitly (`buildMarimekkoRows`): column width is the
  category's share of the grand total, segment height its share within the column, so **area**
  encodes the joint proportion. Not a stacked bar.
- **Violin** — real Gaussian KDE with Silverman's rule-of-thumb bandwidth
  (`0.9·min(σ, IQR/1.34)·n^(−1/5)`); quartile/median marks come from exact type-7 quantiles, not
  from the smoothed curve.
- **Sankey** — d3-sankey's actual layout; link thickness is proportional to flow. Cycles are
  detected and removed first (DFS back-edge colouring) because the algorithm requires a DAG, and
  the count of dropped links is surfaced to the user rather than silently corrupting the diagram.
- **Funnel** — real trapezoid `<polygon>` paths where each stage's bottom edge is the next
  stage's width, so the taper is the actual drop-off. Rendering as bars would misstate the shape.
- **Treemap** — d3-hierarchy squarified tiling: rectangle **area** ∝ value.
- **Bubble / bubble map / network nodes** — radius = `√(value/max)`, so **area** (not radius)
  carries magnitude.
- **Flow map** — `geoInterpolate` sampled along the route gives true great-circle arcs.
- **Choropleth** — real Natural Earth boundaries; "no data" regions render in a distinct grey so
  absent ≠ zero, and unmatched dataset regions are reported explicitly instead of dropped.
- **Matrix** — `mean` subtotals recompute from underlying values rather than averaging cell
  averages (which is wrong when cell counts differ).
- **Radar** — each metric axis normalised to its own observed max, with the normalisation stated
  in the tooltip, so metrics with different units aren't silently misread as comparable.
- **Candlestick / OHLC** — kept as separate renderers because the geometry genuinely differs
  (filled body vs. offset ticks), not just the styling.

## Architecture

- **Registry, not a conditional.** `frontend/src/lib/visualization/registry.ts` +
  `backend/app/visualization/registry.py`, 42 entries each with id/label/category/subcategory/
  description/required+optional encodings/field types/min points/max cardinality/aggregations/
  temporal-geo-hierarchical-relational-OHLC flags/renderer engine. Adding a type = a registry
  entry plus a builder/component, never an edit to a central `if/else`.
- **Dispatch.** `VEGA_BUILDERS` (keyed builders for layered/transform charts) →
  `CHART_TYPE_TO_MARK` (single-mark charts) → `renderNonVegaChart` (D3/map/component). A
  programmatic cross-check confirms all 42 registry ids resolve to exactly one render path.
- **Canonical VisualizationSpec preserved.** All 41 types resolve through the same
  `VisualizationSpec`. It was *extended*, not forked: `x2`/`y2` (range channels), `measure2`
  (dual-axis second measure), and `open/high/low/close` (OHLC). No parallel data format exists.
- **Compatibility engine.** `validation.py::REQUIRED_ENCODINGS` declares each type's required
  channels; `_CHANNEL_GROUPS` enforces that OHLC's four channels are set together or not at all
  (a half-configured OHLC chart silently drops a price, so it's rejected).
- **AI context.** `_SUPPORTED_CHART_TYPES` is generated from `IMPLEMENTED_CHART_TYPES` — Gemini
  is told about exactly the renderable set, and `validate_spec()` still rejects anything invalid
  even if the model ignores the prompt.

## Verification performed

| Check | Result |
| --- | --- |
| `/chart-gallery` live render, all 42 types | 42 cards, 48 SVGs, 2 tables, **0 errors** |
| Registry → render-path cross-check | 42/42 resolve, 0 missing |
| Backend `pytest` | **126 passed** |
| Frontend `vitest` | **30 passed** |
| `tsc --noEmit` | clean |
| `eslint` | clean |
| `ruff check app/` | clean |

## Remaining follow-up (honest gaps, not blockers)

1. **Export path for non-Vega charts** — 14 D3/component charts render correctly but aren't Vega
   views, so the SVG/PNG export button doesn't capture them. Needs a DOM/SVG serialiser branch.
2. **AI auto-recommendation for 3+ encoding types** — the deterministic Story pipeline carries a
   field *pair*, so types needing three channels are studio-only rather than auto-suggested.
   Closing this needs a multi-field Story path, not renderer work.
3. **Chart-specific unit tests** — the new types are covered by the compatibility-engine tests and
   the live gallery render; per-type maths tests (KDE output shape, sankey widths, pivot totals)
   are worth adding. The pure functions were deliberately factored into `lib/visualization/d3-data.ts`
   to make that straightforward.
