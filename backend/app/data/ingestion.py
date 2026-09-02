"""Parse an uploaded file into a Polars DataFrame and serialize it to Parquet.

Never trust the raw dataset to fit in application memory forever — this module only handles
the parse step; large-dataset streaming/chunking is a Phase 27 performance concern.
"""

from __future__ import annotations

import io

import polars as pl


class IngestionError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def parse_to_dataframe(*, extension: str, data: bytes) -> pl.DataFrame:
    try:
        if extension == "csv":
            return pl.read_csv(io.BytesIO(data), infer_schema_length=10_000, try_parse_dates=True)
        if extension == "tsv":
            return pl.read_csv(
                io.BytesIO(data),
                separator="\t",
                infer_schema_length=10_000,
                try_parse_dates=True,
            )
        if extension == "json":
            return pl.read_json(io.BytesIO(data))
        if extension in ("xlsx", "xls"):
            return pl.read_excel(io.BytesIO(data))
        raise IngestionError(f"Unsupported extension for ingestion: .{extension}")
    except IngestionError:
        raise
    except Exception as exc:  # noqa: BLE001 — surfaced as a structured ingestion failure
        raise IngestionError(f"Failed to parse file: {exc}") from exc


def dataframe_to_parquet_bytes(df: pl.DataFrame) -> bytes:
    buffer = io.BytesIO()
    df.write_parquet(buffer)
    return buffer.getvalue()


def normalize_column_name(raw_name: str) -> str:
    """snake_case, strip whitespace — collisions are de-duplicated by the caller."""
    cleaned = "".join(c if c.isalnum() else "_" for c in raw_name.strip().lower())
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned.strip("_") or "column"


def deduplicate_column_names(names: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    result = []
    for name in names:
        if name not in seen:
            seen[name] = 0
            result.append(name)
        else:
            seen[name] += 1
            result.append(f"{name}_{seen[name]}")
    return result
