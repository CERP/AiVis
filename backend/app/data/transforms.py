"""Deterministic, auditable transformations. AI (Phase 11) may *recommend* which of these to
run and with what params — it never mutates data itself. Every transform here is pure, reports
a valid/invalid count, and never silently destroys data (the DataFrame passed in is untouched;
callers build a new DatasetVersion from the result).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import polars as pl

_CURRENCY_CHARS = str.maketrans("", "", "$€£¥,")


@dataclass
class TransformResult:
    series: pl.Series
    valid_count: int
    invalid_count: int
    details: dict = field(default_factory=dict)


def trim_strings(series: pl.Series) -> TransformResult:
    if series.dtype != pl.Utf8:
        return TransformResult(series=series, valid_count=series.len(), invalid_count=0)
    trimmed = series.str.strip_chars()
    changed = int((trimmed != series).sum())
    return TransformResult(
        series=trimmed,
        valid_count=series.len(),
        invalid_count=0,
        details={"rows_changed": changed},
    )


def standardize_case(series: pl.Series, *, case: str = "lower") -> TransformResult:
    if series.dtype != pl.Utf8:
        return TransformResult(series=series, valid_count=series.len(), invalid_count=0)
    if case == "lower":
        result = series.str.to_lowercase()
    elif case == "upper":
        result = series.str.to_uppercase()
    elif case == "title":
        result = series.str.to_titlecase()
    else:
        raise ValueError(f"Unsupported case: {case}")
    return TransformResult(series=result, valid_count=series.len(), invalid_count=0)


def coerce_numeric(series: pl.Series) -> TransformResult:
    """Strips currency symbols/thousands separators and parses to float. Values that still
    don't parse become null (invalid), never silently zeroed."""
    if series.dtype.is_numeric():
        return TransformResult(series=series, valid_count=series.len(), invalid_count=0)

    cleaned = series.cast(pl.Utf8).str.strip_chars()
    cleaned = cleaned.map_elements(
        lambda v: v.translate(_CURRENCY_CHARS) if v is not None else None,
        return_dtype=pl.Utf8,
    )
    parsed = cleaned.cast(pl.Float64, strict=False)

    was_present = series.is_not_null()
    invalid_mask = was_present & parsed.is_null()
    invalid_count = int(invalid_mask.sum())
    valid_count = int(parsed.is_not_null().sum())

    return TransformResult(
        series=parsed,
        valid_count=valid_count,
        invalid_count=invalid_count,
        details={"unparsed_sample": cleaned.filter(invalid_mask).head(5).to_list()},
    )


_DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%b %d %Y", "%B %d %Y", "%Y/%m/%d"]


def parse_dates(series: pl.Series) -> TransformResult:
    """Tries a fixed set of common formats in order; a value counts as valid the first time
    any format matches it. Values matching no format become null (invalid)."""
    if series.dtype in (pl.Date, pl.Datetime):
        return TransformResult(series=series, valid_count=series.len(), invalid_count=0)

    text = series.cast(pl.Utf8)
    result = pl.Series([None] * len(text), dtype=pl.Date)
    remaining_mask = text.is_not_null()

    for fmt in _DATE_FORMATS:
        if not remaining_mask.any():
            break
        attempt = text.str.strptime(pl.Date, fmt, strict=False)
        newly_parsed = remaining_mask & attempt.is_not_null()
        result = pl.select(
            pl.when(newly_parsed).then(attempt).otherwise(pl.lit(result)).alias("d")
        )["d"]
        remaining_mask = remaining_mask & ~newly_parsed

    was_present = series.is_not_null()
    invalid_mask = was_present & result.is_null()
    invalid_count = int(invalid_mask.sum())
    valid_count = int(result.is_not_null().sum())

    return TransformResult(series=result, valid_count=valid_count, invalid_count=invalid_count)


def normalize_percentage(series: pl.Series) -> TransformResult:
    """Converts '50%' or 0-100 numeric scale to a 0-1 float. Already-fractional values
    (<=1) are left as-is."""
    numeric_result = coerce_numeric(series)
    normalized = numeric_result.series.map_elements(
        lambda v: (v / 100.0 if v is not None and v > 1 else v),
        return_dtype=pl.Float64,
    )
    return TransformResult(
        series=normalized,
        valid_count=numeric_result.valid_count,
        invalid_count=numeric_result.invalid_count,
    )


@dataclass
class DedupeResult:
    dataframe: pl.DataFrame
    removed_count: int


def dedupe_rows(df: pl.DataFrame, *, subset: list[str] | None = None) -> DedupeResult:
    before = df.height
    deduped = df.unique(subset=subset, keep="first", maintain_order=True)
    return DedupeResult(dataframe=deduped, removed_count=before - deduped.height)
