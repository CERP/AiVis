"""Turns insights into stories: "what chart/question can this dataset answer" rather than
just "what chart types are compatible." Every story is derived from a real, already-computed
Insight -- never generated independently of one, so it can't outrun what the data supports.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.insight import Insight, InsightType

_QUESTION_TEMPLATES: dict[InsightType, str] = {
    InsightType.TREND: "How did {fields} change over time?",
    InsightType.RANKING: "Which {category} leads on {measure}?",
    InsightType.RELATIONSHIP: "How do {fields} relate to each other?",
    InsightType.OUTLIER: "Which values stand out in {fields}?",
    InsightType.DISTRIBUTION: "What's the typical range of {fields}?",
    InsightType.CHANGE: "What changed in {fields}?",
    InsightType.SEASONALITY: "Does {fields} show a recurring pattern?",
    InsightType.ANOMALY: "What's unusual about {fields}?",
}

_RECOMMENDED_CHART_TYPE: dict[InsightType, str] = {
    InsightType.TREND: "line",
    InsightType.RANKING: "bar",
    InsightType.RELATIONSHIP: "scatter",
    InsightType.OUTLIER: "box_plot",
    InsightType.DISTRIBUTION: "histogram",
    InsightType.CHANGE: "line",
    InsightType.SEASONALITY: "line",
    InsightType.ANOMALY: "scatter",
}


@dataclass
class StoryCandidate:
    title: str
    description: str
    analytical_question: str
    relevant_fields: list[str]
    recommended_chart_type: str
    confidence: float


def _readable_field(name: str) -> str:
    return name.replace("_", " ")


def _build_question(insight: Insight) -> str:
    template = _QUESTION_TEMPLATES.get(insight.type, "What does {fields} show?")
    fields_readable = " and ".join(_readable_field(f) for f in insight.fields)

    if insight.type == InsightType.RANKING and len(insight.fields) == 2:
        category, measure = insight.fields
        return template.format(category=_readable_field(category), measure=_readable_field(measure))

    return template.format(fields=fields_readable)


def story_from_insight(insight: Insight) -> StoryCandidate:
    return StoryCandidate(
        title=insight.title,
        description=insight.description,
        analytical_question=_build_question(insight),
        relevant_fields=list(insight.fields),
        recommended_chart_type=_RECOMMENDED_CHART_TYPE.get(insight.type, "bar"),
        confidence=insight.confidence,
    )


def generate_stories(insights: list[Insight]) -> list[StoryCandidate]:
    return [story_from_insight(insight) for insight in insights]
