import polars as pl

from app.data.transforms import (
    coerce_numeric,
    dedupe_rows,
    normalize_percentage,
    parse_dates,
    standardize_case,
    trim_strings,
)


def test_trim_strings_reports_changed_rows() -> None:
    s = pl.Series(["  a", "b  ", "c"])
    result = trim_strings(s)
    assert result.series.to_list() == ["a", "b", "c"]
    assert result.details["rows_changed"] == 2


def test_coerce_numeric_strips_currency_and_commas() -> None:
    s = pl.Series(["$1,200.50", "980", None])
    result = coerce_numeric(s)
    assert result.series.to_list() == [1200.50, 980.0, None]
    assert result.valid_count == 2
    assert result.invalid_count == 0


def test_coerce_numeric_reports_invalid_for_unparseable_present_values() -> None:
    s = pl.Series(["12", "twenty", None])
    result = coerce_numeric(s)
    assert result.valid_count == 1
    assert result.invalid_count == 1
    assert result.details["unparsed_sample"] == ["twenty"]


def test_parse_dates_handles_multiple_formats() -> None:
    s = pl.Series(["2024-01-03", "01/02/2024", "Jan 4 2024", None])
    result = parse_dates(s)
    assert result.valid_count == 3
    assert result.invalid_count == 0
    assert result.series.null_count() == 1


def test_parse_dates_reports_invalid_for_unparseable_present_values() -> None:
    s = pl.Series(["2024-01-03", "not-a-date"])
    result = parse_dates(s)
    assert result.valid_count == 1
    assert result.invalid_count == 1


def test_normalize_percentage_scales_whole_numbers() -> None:
    s = pl.Series(["50", "0.25", "100"])
    result = normalize_percentage(s)
    assert result.series.to_list() == [0.5, 0.25, 1.0]


def test_dedupe_rows_removes_exact_duplicates() -> None:
    df = pl.DataFrame({"a": [1, 1, 2], "b": ["x", "x", "y"]})
    result = dedupe_rows(df)
    assert result.removed_count == 1
    assert result.dataframe.height == 2


def test_dedupe_rows_respects_subset() -> None:
    df = pl.DataFrame({"a": [1, 1], "b": ["x", "y"]})
    result = dedupe_rows(df, subset=["a"])
    assert result.removed_count == 1


def test_standardize_case_lower() -> None:
    s = pl.Series(["North", "SOUTH"])
    result = standardize_case(s, case="lower")
    assert result.series.to_list() == ["north", "south"]


def test_non_string_series_pass_through_unchanged() -> None:
    s = pl.Series([1, 2, 3])
    assert trim_strings(s).series.to_list() == [1, 2, 3]
    assert standardize_case(s).series.to_list() == [1, 2, 3]
