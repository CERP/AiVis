# Architecture

## Core pipeline

```
Dataset → Data Profiler → Data Semantics → Insight Engine → Story Engine
        → Visualization Recommender → Visualization Spec → Design System
        → Renderer → Visualization Studio
```

Every stage produces a typed, persisted artifact (profile, insight, story, spec, version) —
nothing is regenerated silently or hidden in an LLM response.

## Data flow

```
Upload → Object storage (raw) → Ingestion (Polars) → Parquet → DuckDB query layer
       → Profiler → Profile persisted (Postgres) → Insight/Story engines
       → Recommendation engine → VisualizationSpec → Renderer (D3 / Vega-Lite)
```

Large datasets never load entirely into the browser or into an LLM prompt — the frontend
queries paginated/aggregated results, and the AI layer receives only profiler-derived summaries
(see [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)).

## Visualization abstraction

```
VisualizationSpec (canonical, versioned)
        ↓
Validation (schema + dataset compatibility)
        ↓
Renderer dispatch → D3 renderer | Vega-Lite renderer | specialized renderer
```

The renderer never executes AI-generated code. AI output is always a structured spec/command,
validated before it can affect a chart.

## Database schema (see backend/app/models)

`users, organizations, memberships, projects, datasets, dataset_versions, dataset_columns,
data_profiles, cleaning_operations, insights, stories, visualizations, visualization_versions,
themes, exports, audit_logs` — normalized, FK-constrained, timestamped.

## Future extension point (Phase 2, not implemented)

`VisualizationCommand` + `VisualizationMutation` interfaces in
`backend/app/visualization/commands.py` let a future chatbot submit structured commands
(`change_chart_type`, `add_annotation`, ...) that flow through the same validator and
versioning system as manual studio edits. No chatbot code exists yet.
