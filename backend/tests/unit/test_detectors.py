import polars as pl

from app.insights.detectors import (
    detect_distribution,
    detect_outliers,
    detect_ranking,
    detect_relationship,
    detect_trend,
)


def test_detect_trend_increasing() -> None:
    df = pl.DataFrame(
        {
            "date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
            "revenue": [100.0, 110.0, 120.0, 150.0],
        }
    )
    insight = detect_trend(df, "date", "revenue")
    assert insight is not None
    assert insight.type == "trend"
    assert insight.calculation["delta_pct"] == 50.0
    assert "increased" in insight.description


def test_detect_trend_returns_none_for_too_few_rows() -> None:
    df = pl.DataFrame({"date": ["2024-01-01", "2024-01-02"], "revenue": [100.0, 110.0]})
    assert detect_trend(df, "date", "revenue") is None


def test_detect_ranking_finds_top_category() -> None:
    df = pl.DataFrame(
        {
            "region": ["North", "North", "South", "South", "East"],
            "revenue": [100.0, 200.0, 50.0, 50.0, 10.0],
        }
    )
    insight = detect_ranking(df, "region", "revenue")
    assert insight is not None
    assert insight.calculation["top_category"] == "North"
    assert insight.calculation["top_value"] == 300.0


def test_detect_ranking_returns_none_for_single_category() -> None:
    df = pl.DataFrame({"region": ["North", "North"], "revenue": [100.0, 200.0]})
    assert detect_ranking(df, "region", "revenue") is None


def test_detect_outliers_finds_extreme_value() -> None:
    df = pl.DataFrame({"value": [10.0, 11.0, 12.0, 13.0, 12.0, 500.0]})
    insight = detect_outliers(df, "value")
    assert insight is not None
    assert 500.0 in insight.calculation["outlier_values"]


def test_detect_outliers_returns_none_when_no_outliers() -> None:
    df = pl.DataFrame({"value": [10.0, 11.0, 12.0, 13.0, 12.0]})
    assert detect_outliers(df, "value") is None


def test_detect_relationship_finds_strong_positive_correlation() -> None:
    df = pl.DataFrame({"ad_spend": [1, 2, 3, 4, 5], "revenue": [10, 20, 30, 40, 50]})
    insight = detect_relationship(df, "ad_spend", "revenue")
    assert insight is not None
    assert insight.calculation["r"] == 1.0
    assert "positive" in insight.title.lower()


def test_detect_relationship_returns_none_for_weak_correlation() -> None:
    df = pl.DataFrame({"a": [1, 2, 3, 4, 5], "b": [5, 1, 4, 2, 3]})
    assert detect_relationship(df, "a", "b") is None


def test_detect_distribution_reports_iqr() -> None:
    df = pl.DataFrame({"value": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]})
    insight = detect_distribution(df, "value")
    assert insight is not None
    assert insight.calculation["metric"] == "interquartile_range"
