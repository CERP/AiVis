# Data Engine

## Pipeline

```
Uploaded dataset → Object storage (raw, immutable) → Ingestion (Polars)
                 → Arrow / Parquet → DuckDB query layer → Profiling
                 → Semantic understanding → Analytics
```

## Principles

- The original uploaded file is never modified. Cleaning/structuring produces a new
  `dataset_version`; the raw version is always retrievable.
- Datasets are never loaded entirely into browser memory — the frontend queries paginated or
  aggregated slices via the API, backed by DuckDB over Parquet.
- All transformations (`app/data/transforms.py`) are deterministic, pure functions with a
  validation report (e.g. "49,982 valid / 18 invalid") and are logged to `cleaning_operations`.
- AI recommends transformations; it never executes them. The data engine executes and reports.

## Supported input handling

CSV, Excel, JSON (incl. nested) ingestion via Polars, with graceful handling of: inconsistent
column names, mixed date formats, numbers-as-strings, inconsistent percentages/currency,
missing values, duplicate rows, malformed files.
