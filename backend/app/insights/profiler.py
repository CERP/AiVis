"""Deterministic column profiling: type inference, statistics, PII heuristics.

Everything here runs locally against the parsed DataFrame — nothing is sent to an LLM.
This is the "Local Data Profiler" that Phase 11 (AI integration) will summarize before
ever building a prompt, per the data-minimization principle in AI_ARCHITECTURE.md.
"""

from __future__ import annotations

import re

import polars as pl

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?[\d\s\-().]{7,20}$")
_PII_NAME_HINTS = {
    "email",
    "e_mail",
    "phone",
    "phone_number",
    "ssn",
    "social_security",
    "first_name",
    "last_name",
    "full_name",
    "address",
    "street_address",
    "date_of_birth",
    "dob",
    "passport",
    "credit_card",
}

_GEO_NAME_HINTS = {
    "country",
    "state",
    "province",
    "city",
    "region",
    "latitude",
    "longitude",
    "lat",
    "lon",
    "lng",
    "zip",
    "zipcode",
    "postal_code",
}


def infer_semantic_type(column_name: str, series: pl.Series) -> str:
    dtype = series.dtype
    lower_name = column_name.lower()

    if dtype in (pl.Date, pl.Datetime):
        return "date"
    if dtype in (pl.Boolean,):
        return "boolean"
    if dtype.is_numeric():
        if lower_name in _GEO_NAME_HINTS:
            return "geographic"
        non_null = series.drop_nulls()
        is_fully_unique = len(non_null) > 0 and non_null.n_unique() == len(non_null)
        if is_fully_unique and _looks_like_id(lower_name):
            return "identifier"
        return "currency" if _looks_like_currency(lower_name) else "numeric"
    if dtype == pl.Utf8:
        if lower_name in _GEO_NAME_HINTS:
            return "geographic"
        if _looks_like_id(lower_name):
            return "identifier"
        non_null = series.drop_nulls()
        if len(non_null) == 0:
            return "text"
        cardinality_ratio = non_null.n_unique() / len(non_null)
        if cardinality_ratio < 0.5:
            return "categorical"
        return "text"
    return "text"


def _looks_like_id(lower_name: str) -> bool:
    return lower_name == "id" or lower_name.endswith("_id") or lower_name.endswith("id")


def _looks_like_currency(lower_name: str) -> bool:
    return any(hint in lower_name for hint in ("price", "revenue", "cost", "amount", "salary"))


def detect_pii(column_name: str, series: pl.Series) -> bool:
    lower_name = column_name.lower()
    if lower_name in _PII_NAME_HINTS:
        return True

    if series.dtype != pl.Utf8:
        return False

    sample = series.drop_nulls().head(50)
    if len(sample) == 0:
        return False

    email_matches = sum(1 for v in sample if _EMAIL_RE.match(v))
    if email_matches / len(sample) > 0.5:
        return True

    phone_matches = sum(1 for v in sample if _PHONE_RE.match(v))
    return phone_matches / len(sample) > 0.5


def profile_column(series: pl.Series) -> dict:
    """Returns (null_count, unique_count, stats) for one column."""
    null_count = series.null_count()
    non_null = series.drop_nulls()
    unique_count = non_null.n_unique()

    stats: dict = {}
    if series.dtype.is_numeric() and len(non_null) > 0:
        stats["min"] = non_null.min()
        stats["max"] = non_null.max()
        stats["mean"] = non_null.mean()
        stats["median"] = non_null.median()
        stats["std"] = non_null.std()
        stats.update(_distribution_shape(non_null))
        stats["outliers"] = _iqr_outlier_count(non_null)
    elif series.dtype in (pl.Date, pl.Datetime) and len(non_null) > 0:
        stats["min"] = str(non_null.min())
        stats["max"] = str(non_null.max())
    elif series.dtype == pl.Utf8 and len(non_null) > 0:
        value_counts = non_null.value_counts(sort=True).head(10)
        stats["top_values"] = {
            str(row[0]): row[1] for row in value_counts.iter_rows()
        }

    return {
        "null_count": null_count,
        "unique_count": unique_count,
        "stats": stats,
    }


def _distribution_shape(series: pl.Series) -> dict:
    mean = series.mean()
    median = series.median()
    if mean is None or median is None or median == 0:
        return {"skew": "unknown"}
    ratio = (mean - median) / abs(median) if median != 0 else 0
    if ratio > 0.15:
        skew = "right-skewed"
    elif ratio < -0.15:
        skew = "left-skewed"
    else:
        skew = "approximately symmetric"
    return {"skew": skew}


def _iqr_outlier_count(series: pl.Series) -> int:
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    if q1 is None or q3 is None:
        return 0
    iqr = q3 - q1
    if iqr == 0:
        return 0
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    return int(((series < lower_bound) | (series > upper_bound)).sum())
