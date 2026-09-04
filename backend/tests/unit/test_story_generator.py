import uuid

from app.insights.story_generator import generate_stories, stories_from_insight
from app.models.insight import Insight, InsightType


def _insight(type_: InsightType, fields: list[str], title: str = "t") -> Insight:
    return Insight(
        dataset_version_id=uuid.uuid4(),
        type=type_,
        title=title,
        description="desc",
        fields=fields,
        calculation={"metric": "x"},
        confidence=0.8,
    )


def test_trend_story_asks_change_over_time_question() -> None:
    insight = _insight(InsightType.TREND, ["date", "revenue"])
    stories = stories_from_insight(insight)
    assert len(stories) == 1
    assert "change over time" in stories[0].analytical_question.lower()
    assert stories[0].recommended_chart_type == "line"
    assert stories[0].relevant_fields == ["date", "revenue"]


def test_ranking_story_uses_category_and_measure_phrasing() -> None:
    insight = _insight(InsightType.RANKING, ["region", "revenue"])
    stories = stories_from_insight(insight)
    assert "which region leads on revenue" in stories[0].analytical_question.lower()


def test_ranking_produces_multiple_chart_type_variants() -> None:
    insight = _insight(InsightType.RANKING, ["region", "revenue"])
    stories = stories_from_insight(insight)
    chart_types = [s.recommended_chart_type for s in stories]
    assert chart_types == ["bar", "donut", "pie"]
    # first variant keeps the source insight's confidence; later ones step down slightly so the
    # clearest default reading ranks first without claiming the others are equally likely.
    assert stories[0].confidence == insight.confidence
    assert stories[1].confidence < stories[0].confidence
    assert stories[2].confidence < stories[1].confidence
    assert all(s.insight_id == insight.id for s in stories)


def test_relationship_story_recommends_scatter() -> None:
    insight = _insight(InsightType.RELATIONSHIP, ["ad_spend", "revenue"])
    stories = stories_from_insight(insight)
    assert len(stories) == 1
    assert stories[0].recommended_chart_type == "scatter"


def test_story_confidence_matches_source_insight_for_single_variant_types() -> None:
    insight = _insight(InsightType.OUTLIER, ["revenue"])
    insight.confidence = 0.42
    stories = stories_from_insight(insight)
    assert len(stories) == 1
    assert stories[0].confidence == 0.42


def test_composition_hierarchy_flow_each_produce_three_variants() -> None:
    for insight_type, expected_types in (
        (InsightType.COMPOSITION, ["stacked_bar", "heatmap", "marimekko"]),
        (InsightType.HIERARCHY, ["treemap", "sunburst", "decomposition_tree"]),
        (InsightType.FLOW, ["sankey", "network", "chord"]),
    ):
        insight = _insight(insight_type, ["a", "b", "value"])
        stories = stories_from_insight(insight)
        assert [s.recommended_chart_type for s in stories] == expected_types


def test_generate_stories_preserves_order_and_flattens_variants() -> None:
    insights = [
        _insight(InsightType.TREND, ["date", "revenue"]),
        _insight(InsightType.RANKING, ["region", "revenue"]),
    ]
    stories = generate_stories(insights)
    # 1 trend variant + 3 ranking variants
    assert len(stories) == 4
    assert stories[0].recommended_chart_type == "line"
    assert [s.recommended_chart_type for s in stories[1:]] == ["bar", "donut", "pie"]
