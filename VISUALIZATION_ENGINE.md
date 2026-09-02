# Visualization Engine

## Specification → validation → render

```
VisualizationSpec (id, dataset, chartType, dimensions, measures, encodings,
                    transformations, filters, sorting, annotations, theme,
                    typography, layout, interactions, metadata)
        ↓
Validation (schema shape + compatibility with dataset columns)
        ↓
Renderer dispatch → D3 (custom renderers) | Vega-Lite (registry fallback) | specialized
```

The spec is the single source of truth for a chart's state. It is versioned
(`visualization_versions`) — every mutation (chart type change, theme change, annotation add)
creates a new version, enabling undo/redo and history.

## Registry

`app/visualization/registry.py` lists chart types by category (comparison, temporal,
distribution, relationship, part-to-whole, geographic, hierarchical, specialized) with required
encodings and data-type compatibility rules, used by the recommendation engine's compatibility
filter. Renderers are implemented incrementally; the registry tracks implemented vs. planned.

## Recommendation pipeline

```
Dataset → candidate generation → compatibility filter → analytical relevance
        → insight potential → readability/accessibility → editorial suitability
        → redundancy filter → ranked top 8
```

Never "ask the LLM for 8 charts" — candidates are generated deterministically from the schema
and profile; AI (if used) only assists with ranking rationale, not generation.

## Themes

Editorial theme tokens (colors, typography, spacing, grid, annotations, axes, labels,
background, borders, emphasis) live in `app/visualization/themes.py`, generated with
accessibility (contrast, colorblind-safety) as a hard constraint, not an afterthought.
