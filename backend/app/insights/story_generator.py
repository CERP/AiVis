"""Turns insights into stories: "what chart/question can this dataset answer" rather than
just "what chart types are compatible." Every story is derived from a real, already-computed
Insight -- never generated independently of one, so it can't outrun what the data supports.

Some insight types genuinely support more than one meaningful chart type (a composition insight
is equally valid as a stacked bar, a heatmap, or a marimekko -- they emphasize different things,
not the same chart in a different skin). Those insight types produce one Story per chart type;
everything else still produces exactly one Story, matching the original design.
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
    InsightType.COMPOSITION: "How does {fields} break down?",
    InsightType.HIERARCHY: "How does {fields} nest and compare?",
    InsightType.FLOW: "How does {fields} flow from one to the other?",
}

# Single chart type per insight type -- the common case.
_RECOMMENDED_CHART_TYPE: dict[InsightType, str] = {
    InsightType.TREND: "line",
    InsightType.OUTLIER: "box_plot",
    InsightType.DISTRIBUTION: "histogram",
    InsightType.CHANGE: "line",
    InsightType.SEASONALITY: "line",
    InsightType.ANOMALY: "scatter",
    InsightType.RELATIONSHIP: "scatter",
}

# Insight types that genuinely support more than one meaningful chart type -- each produces its
# own Story so the recommendation engine can surface more than one, rather than picking a single
# "winner" chart type on the insight's behalf. Confidence is shaded slightly per entry so the
# first listed (generally the clearest default reading of the data) ranks first when both pass
# validation; the redundancy filter in recommendation.py groups same-family entries so near
# duplicates (e.g. pie/donut) don't both survive to the final list, while genuinely different
# geometries (stacked_bar vs heatmap vs marimekko) all remain candidates.
_MULTI_CHART_TYPES: dict[InsightType, list[str]] = {
    InsightType.RANKING: ["bar", "donut", "pie"],
    InsightType.COMPOSITION: ["stacked_bar", "heatmap", "marimekko"],
    InsightType.HIERARCHY: ["treemap", "sunburst", "decomposition_tree"],
    InsightType.FLOW: ["sankey", "network", "chord"],
}


@dataclass
class StoryCandidate:
    insight_id: object
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


def stories_from_insight(insight: Insight) -> list[StoryCandidate]:
    question = _build_question(insight)
    chart_types = _MULTI_CHART_TYPES.get(insight.type)
    if chart_types is None:
        chart_types = [_RECOMMENDED_CHART_TYPE.get(insight.type, "bar")]

    candidates: list[StoryCandidate] = []
    for i, chart_type in enumerate(chart_types):
        # A small, deterministic confidence step per variant -- keeps the first (clearest
        # default) reading ranked above its siblings without pretending they're equally likely
        # to be the "best" view, while still letting all of them through to the ranking stage.
        confidence = max(0.05, insight.confidence - i * 0.03)
        candidates.append(
            StoryCandidate(
                insight_id=insight.id,
                title=insight.title,
                description=insight.description,
                analytical_question=question,
                relevant_fields=list(insight.fields),
                recommended_chart_type=chart_type,
                confidence=confidence,
            )
        )
    return candidates


def generate_stories(insights: list[Insight]) -> list[StoryCandidate]:
    return [candidate for insight in insights for candidate in stories_from_insight(insight)]
