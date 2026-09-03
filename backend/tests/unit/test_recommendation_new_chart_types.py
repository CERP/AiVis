"""The deterministic recommendation engine can now surface the new orientation/ranking chart
types (horizontal_bar, sorted_bar, waterfall, sparkline) for a 2-field Story, same as it already
does for bar/line. 3-field types (stacked_bar, heatmap, bubble) deliberately aren't generated
here -- the Story pipeline only ever carries a field pair -- and remain manual-studio-only."""

import uuid

from app.models.insight import Story
from app.visualization.recommendation import generate_recommendations

_SEMANTIC_TYPES = {"region": "categorical", "revenue": "currency"}


def _story(chart_type: str) -> Story:
    return Story(
        dataset_version_id=uuid.uuid4(),
        title="Revenue by region",
        description="desc",
        analytical_question="Which region leads on revenue?",
        relevant_fields=["region", "revenue"],
        recommended_chart_type=chart_type,
        confidence=0.8,
    )


def test_horizontal_bar_recommendation_is_generated_and_valid() -> None:
    recs = generate_recommendations([_story("horizontal_bar")], _SEMANTIC_TYPES, "v1")
    assert len(recs) == 1
    assert recs[0].spec.chart_type == "horizontal_bar"
    assert recs[0].spec.encoding.y.aggregation == "sum"


def test_waterfall_recommendation_is_generated_and_valid() -> None:
    recs = generate_recommendations([_story("waterfall")], _SEMANTIC_TYPES, "v1")
    assert len(recs) == 1
    assert recs[0].spec.chart_type == "waterfall"


def test_sparkline_recommendation_is_generated_and_valid() -> None:
    recs = generate_recommendations([_story("sparkline")], _SEMANTIC_TYPES, "v1")
    assert len(recs) == 1
    assert recs[0].spec.chart_type == "sparkline"


def test_sorted_bar_recommendation_is_generated_and_valid() -> None:
    recs = generate_recommendations([_story("sorted_bar")], _SEMANTIC_TYPES, "v1")
    assert len(recs) == 1
    assert recs[0].spec.chart_type == "sorted_bar"
