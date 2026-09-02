import uuid

from app.insights.story_generator import generate_stories, story_from_insight
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
    story = story_from_insight(insight)
    assert "change over time" in story.analytical_question.lower()
    assert story.recommended_chart_type == "line"
    assert story.relevant_fields == ["date", "revenue"]


def test_ranking_story_uses_category_and_measure_phrasing() -> None:
    insight = _insight(InsightType.RANKING, ["region", "revenue"])
    story = story_from_insight(insight)
    assert "which region leads on revenue" in story.analytical_question.lower()
    assert story.recommended_chart_type == "bar"


def test_relationship_story_recommends_scatter() -> None:
    insight = _insight(InsightType.RELATIONSHIP, ["ad_spend", "revenue"])
    story = story_from_insight(insight)
    assert story.recommended_chart_type == "scatter"


def test_story_confidence_matches_source_insight() -> None:
    insight = _insight(InsightType.OUTLIER, ["revenue"])
    insight.confidence = 0.42
    story = story_from_insight(insight)
    assert story.confidence == 0.42


def test_generate_stories_preserves_order_and_count() -> None:
    insights = [
        _insight(InsightType.TREND, ["date", "revenue"]),
        _insight(InsightType.RANKING, ["region", "revenue"]),
    ]
    stories = generate_stories(insights)
    assert len(stories) == 2
    assert stories[0].recommended_chart_type == "line"
    assert stories[1].recommended_chart_type == "bar"
