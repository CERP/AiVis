"""Visualization recommendation engine.

Never "ask the LLM for 8 charts." Candidates come from real Stories (Phase 13), which are
themselves derived from real Insights (Phase 12) -- so every recommendation already carries
analytical relevance and insight strength by construction. This module's job is narrower:
turn each story into a concrete, validated VisualizationSpec (compatibility filtering),
drop near-duplicate field combinations (redundancy filtering), and rank what's left.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.ai.schemas import AnalyticalFinding
from app.models.insight import Story
from app.visualization.spec import (
    Encoding,
    Encodings,
    EncodingType,
    VisualizationMetadata,
    VisualizationSpec,
)
from app.visualization.validation import validate_spec

_TEMPORAL_TYPES = {"date"}
_NOMINAL_TYPES = {"categorical", "geographic", "identifier", "boolean", "text"}
_QUANTITATIVE_TYPES = {"numeric", "currency"}

_SINGLE_FIELD_CHART_TYPES = {"histogram", "box_plot"}


@dataclass
class VisualizationRecommendation:
    """Plain analytics-card content -- title is a data-driven headline (e.g. "Strong positive
    relationship between revenue and units"), description is its supporting stat. No narrative
    "question" framing or "why recommended" copy: this is an analytics tool, not a storytelling
    product. confidence is the underlying insight's confidence score, shown as a plain number."""

    story_id: str
    title: str
    description: str
    spec: VisualizationSpec
    confidence: float


def _encoding_type_for(semantic_type: str | None) -> EncodingType | None:
    if semantic_type in _TEMPORAL_TYPES:
        return EncodingType.TEMPORAL
    if semantic_type in _QUANTITATIVE_TYPES:
        return EncodingType.QUANTITATIVE
    if semantic_type in _NOMINAL_TYPES:
        return EncodingType.NOMINAL
    return None


def _build_spec(
    *,
    fields: list[str],
    chart_type: str,
    title: str,
    column_semantic_types: dict[str, str],
    dataset_version_id: str,
    story_id: str,
) -> VisualizationSpec | None:
    if not fields:
        return None

    field_types = [(f, column_semantic_types.get(f)) for f in fields]
    if any(t is None for _, t in field_types):
        return None

    encoding = Encodings()

    if chart_type in _SINGLE_FIELD_CHART_TYPES or len(fields) == 1:
        field_name, semantic_type = field_types[0]
        enc_type = _encoding_type_for(semantic_type)
        if enc_type is None:
            return None
        encoding.x = Encoding(field=field_name, type=enc_type)
    elif len(fields) == 2:
        (field_a, type_a), (field_b, type_b) = field_types
        enc_a = _encoding_type_for(type_a)
        enc_b = _encoding_type_for(type_b)
        if enc_a is None or enc_b is None:
            return None

        # Categorical/temporal goes on x, quantitative on y; two quantitative fields
        # (a relationship) keep source order on x/y for a scatter plot.
        if enc_a == EncodingType.QUANTITATIVE and enc_b != EncodingType.QUANTITATIVE:
            x_field, x_type, y_field, y_type = field_b, enc_b, field_a, enc_a
        else:
            x_field, x_type, y_field, y_type = field_a, enc_a, field_b, enc_b

        aggregatable_charts = {"bar", "grouped_bar", "line", "area"}
        is_aggregatable = y_type == EncodingType.QUANTITATIVE and chart_type in aggregatable_charts
        aggregation = "sum" if is_aggregatable else "none"
        encoding.x = Encoding(field=x_field, type=x_type)
        encoding.y = Encoding(field=y_field, type=y_type, aggregation=aggregation)
    else:
        return None

    return VisualizationSpec(
        chart_type=chart_type,
        encoding=encoding,
        typography={"title": title},
        metadata=VisualizationMetadata(
            dataset_id="", dataset_version_id=dataset_version_id, story_id=story_id
        ),
    )


def _redundancy_key(spec: VisualizationSpec) -> tuple:
    """Keyed on field-set alone, not chart_type: a bar chart and a line chart over the same two
    fields answer the same analytical question, so they're redundant regardless of mark type
    (per the "Bar vs Horizontal Bar vs Lollipop" guidance -- avoid near-duplicate candidates)."""
    fields = tuple(
        sorted(
            f
            for f in (
                spec.encoding.x.field if spec.encoding.x else None,
                spec.encoding.y.field if spec.encoding.y else None,
            )
            if f
        )
    )
    return fields


def generate_recommendations(
    stories: list[Story],
    column_semantic_types: dict[str, str],
    dataset_version_id: str,
    ai_findings: list[AnalyticalFinding] | None = None,
) -> list[VisualizationRecommendation]:
    """The deterministic Story-derived candidates are always the core of the list. AI findings
    (Gemini, advisory only) can *add* candidates for field combinations the fixed detector set
    didn't cover -- every AI-derived field reference is re-validated against the real schema
    here, exactly like a Story-derived one, so a hallucinated column can never reach the user.
    Gemini's own ranking/confidence is never trusted directly for ordering beyond this."""
    seen_keys: set[tuple] = set()
    recommendations: list[VisualizationRecommendation] = []

    for story in stories:
        spec = _build_spec(
            fields=story.relevant_fields,
            chart_type=story.recommended_chart_type or "bar",
            title=story.title,
            column_semantic_types=column_semantic_types,
            dataset_version_id=dataset_version_id,
            story_id=str(story.id),
        )
        if spec is None:
            continue

        result = validate_spec(spec, column_semantic_types)
        if not result.is_valid:
            continue

        key = _redundancy_key(spec)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        recommendations.append(
            VisualizationRecommendation(
                story_id=str(story.id),
                title=story.title,
                description=story.description,
                spec=spec,
                confidence=story.confidence,
            )
        )

    for index, finding in enumerate(ai_findings or []):
        if not all(f in column_semantic_types for f in finding.fields):
            continue  # references a field that doesn't exist -- discard, never fabricate

        spec = _build_spec(
            fields=finding.fields,
            chart_type=finding.suggested_chart_type or "bar",
            title=finding.description,
            column_semantic_types=column_semantic_types,
            dataset_version_id=dataset_version_id,
            story_id=f"ai-finding:{index}",
        )
        if spec is None:
            continue

        result = validate_spec(spec, column_semantic_types)
        if not result.is_valid:
            continue

        key = _redundancy_key(spec)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        recommendations.append(
            VisualizationRecommendation(
                story_id=f"ai-finding:{index}",
                title=finding.description,
                description=f"AI-identified {finding.type.value}: {finding.description}",
                spec=spec,
                confidence=finding.confidence,
            )
        )

    recommendations.sort(key=lambda r: r.confidence, reverse=True)
    return recommendations


def split_top_and_derived(
    recommendations: list[VisualizationRecommendation], *, top_n: int = 8
) -> tuple[list[VisualizationRecommendation], list[VisualizationRecommendation]]:
    return recommendations[:top_n], recommendations[top_n:]


def recommendation_shortfall_reason(count: int, *, top_n: int = 8) -> str | None:
    """Never fabricate filler charts just to hit a round number -- when a dataset genuinely
    can't support `top_n` meaningfully-different visualizations, say so explicitly instead of
    padding the list."""
    if count >= top_n:
        return None
    if count == 0:
        return "This dataset didn't produce any confident, non-redundant visualization candidates."
    return (
        f"Only {count} meaningfully different visualization{'s' if count != 1 else ''} could be "
        "generated for this dataset without duplicating the same analytical question."
    )
