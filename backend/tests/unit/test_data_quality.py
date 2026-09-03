import polars as pl

from app.insights.data_quality import ColumnQualityInput, analyze_data_quality


def test_clean_data_scores_100_with_no_issues() -> None:
    df = pl.DataFrame({"category": ["A", "B", "C", "D"], "value": [1, 2, 3, 4]})
    columns = [
        ColumnQualityInput(
            name="category", semantic_type="categorical", raw_type="Utf8",
            null_count=0, unique_count=4, stats={},
        ),
        ColumnQualityInput(
            name="value", semantic_type="numeric", raw_type="Int64",
            null_count=0, unique_count=4, stats={"outliers": 0},
        ),
    ]
    report = analyze_data_quality(df, columns)
    assert report.score == 100
    assert report.issues == []


def test_missing_values_flagged_with_percentage() -> None:
    df = pl.DataFrame({"value": [1, None, None, 4, 5, 6, 7, 8, 9, 10]})
    columns = [
        ColumnQualityInput(
            name="value", semantic_type="numeric", raw_type="Int64",
            null_count=2, unique_count=8, stats={},
        )
    ]
    report = analyze_data_quality(df, columns)
    issue = next(i for i in report.issues if i.type == "missing_values")
    assert "20.0%" in issue.description
    assert report.score < 100


def test_duplicate_rows_detected() -> None:
    df = pl.DataFrame({"a": [1, 1, 2, 3], "b": ["x", "x", "y", "z"]})
    columns = [
        ColumnQualityInput(name="a", semantic_type="numeric", raw_type="Int64", null_count=0, unique_count=3, stats={}),
        ColumnQualityInput(name="b", semantic_type="categorical", raw_type="Utf8", null_count=0, unique_count=3, stats={}),
    ]
    report = analyze_data_quality(df, columns)
    issue = next(i for i in report.issues if i.type == "duplicate_rows")
    # is_duplicated() flags every row that's part of a duplicate group, not just the "extra"
    # copies -- both identical rows count.
    assert "2 duplicate rows" in issue.description


def test_empty_column_flagged_and_skips_other_checks() -> None:
    df = pl.DataFrame({"empty": [None, None, None], "other": [1, 2, 3]})
    columns = [
        ColumnQualityInput(name="empty", semantic_type=None, raw_type="Utf8", null_count=3, unique_count=0, stats={}),
        ColumnQualityInput(name="other", semantic_type="numeric", raw_type="Int64", null_count=0, unique_count=3, stats={}),
    ]
    report = analyze_data_quality(df, columns)
    types = [i.type for i in report.issues]
    assert types == ["empty_column"]


def test_constant_column_flagged() -> None:
    df = pl.DataFrame({"flag": ["yes", "yes", "yes"]})
    columns = [
        ColumnQualityInput(name="flag", semantic_type="categorical", raw_type="Utf8", null_count=0, unique_count=1, stats={})
    ]
    report = analyze_data_quality(df, columns)
    assert any(i.type == "constant_column" for i in report.issues)


def test_inconsistent_categories_detected_via_case_normalization() -> None:
    df = pl.DataFrame({"state": ["NY", "ny", "CA", "ca", "TX"]})
    columns = [
        ColumnQualityInput(name="state", semantic_type="categorical", raw_type="Utf8", null_count=0, unique_count=5, stats={})
    ]
    report = analyze_data_quality(df, columns)
    issue = next(i for i in report.issues if i.type == "inconsistent_categories")
    assert "state" in issue.description


def test_high_cardinality_categorical_flagged() -> None:
    values = [f"item-{i}" for i in range(30)]
    df = pl.DataFrame({"sku": values})
    columns = [
        ColumnQualityInput(name="sku", semantic_type="categorical", raw_type="Utf8", null_count=0, unique_count=30, stats={})
    ]
    report = analyze_data_quality(df, columns)
    assert any(i.type == "high_cardinality" for i in report.issues)


def test_outliers_flagged_from_existing_profiler_stats() -> None:
    df = pl.DataFrame({"value": list(range(1, 21))})
    columns = [
        ColumnQualityInput(
            name="value", semantic_type="numeric", raw_type="Int64",
            null_count=0, unique_count=20, stats={"outliers": 1},
        )
    ]
    report = analyze_data_quality(df, columns)
    assert any(i.type == "outliers" for i in report.issues)


def test_score_never_goes_below_zero() -> None:
    # 7 empty columns (high severity, -15 each = -105) is already enough penalty to exceed 100
    # on its own -- proves the clamp, independent of the also-triggered duplicate_rows issue.
    names = [f"col{i}" for i in range(7)]
    df = pl.DataFrame({n: [None] * 10 for n in names})
    columns = [
        ColumnQualityInput(name=n, semantic_type=None, raw_type="Utf8", null_count=10, unique_count=0, stats={})
        for n in names
    ]
    report = analyze_data_quality(df, columns)
    assert report.score == 0
