"""Visualization recommendation engine.

Never "ask the LLM for 8 charts." Candidates come from real Stories (Phase 13), which are
themselves derived from real Insights (Phase 12) -- so every recommendation already carries
analytical relevance and insight strength by construction. This module's job is narrower:
turn each story into a concrete, validated VisualizationSpec (compatibility filtering),
drop near-duplicate field combinations (redundancy filtering), and rank what's left.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.ai.schemas import AnalyticalFinding, ChartRecommendation
from app.models.insight import Story
from app.visualization.spec import (
    Aggregation,
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

# Field-role assignment for the 3-field chart types fed by the composition/hierarchy/flow
# detectors (app/insights/detectors.py). Each detector always returns `fields` in a fixed,
# documented order (e.g. flow is always [source, target, value]), so the mapping here is
# positional, not a semantic-type guess -- channel `i` gets `fields[i]`.
_THREE_FIELD_CHANNEL_ORDER: dict[str, tuple[str, str, str]] = {
    # composition: [category_a, category_b, value] -> x, color, y (stacked bar)
    "stacked_bar": ("x", "color", "y"),
    "stacked_bar_horizontal": ("y", "color", "x"),
    "heatmap": ("x", "y", "color"),
    "marimekko": ("x", "y", "size"),
    # hierarchy: [outer, inner, value] -> detail, color, size
    "treemap": ("detail", "color", "size"),
    "sunburst": ("detail", "color", "size"),
    "decomposition_tree": ("detail", "color", "size"),
    # flow: [source, target, value] -> x, y, size
    "sankey": ("x", "y", "size"),
    "network": ("x", "y", "size"),
    "chord": ("x", "y", "size"),
}

# Part-to-whole charts encode via color+size (a category's arc/slice), never x/y -- [category,
# value] from a ranking Story maps directly onto that.
_TWO_FIELD_CHANNEL_ORDER: dict[str, tuple[str, str]] = {
    "pie": ("color", "size"),
    "donut": ("color", "size"),
}

# Groups chart types that answer the *same* analytical question in a different skin -- these
# collide in the redundancy filter so only one survives, matching "Bar vs Horizontal Bar vs
# Lollipop... all showing essentially the same analytical question." pie/donut collapse into
# each other (near-visual-duplicates) but are their own family, distinct from bar/line, since a
# part-to-whole reading and a magnitude-ranking reading of the same two fields are genuinely
# different questions -- both should be able to survive for the same ranking insight.
#
# Chart types NOT listed here default to their own chart_type as the family (via `.get(type,
# type)` below), so they only collide with an identical chart_type -- this is what keeps
# stacked_bar/heatmap/marimekko (same 3 fields, composition detector), treemap/sunburst/
# decomposition_tree (same 3 fields, hierarchy detector), and sankey/network/chord (same 3
# fields, flow detector) all distinct from their own siblings despite reading identical fields.
_CHART_FAMILY: dict[str, str] = {
    "bar": "bar_or_trend", "horizontal_bar": "bar_or_trend", "sorted_bar": "bar_or_trend",
    "grouped_bar": "bar_or_trend", "waterfall": "bar_or_trend",
    "line": "bar_or_trend", "area": "bar_or_trend", "sparkline": "bar_or_trend",
    "pie": "part_to_whole", "donut": "part_to_whole",
}


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
    generated_by: str = "deterministic",
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
    elif len(fields) == 2 and chart_type in _TWO_FIELD_CHANNEL_ORDER:
        # Part-to-whole charts always encode [category, value] -> color, size, regardless of
        # which position each field arrived in -- a ranking Story's fields are already exactly
        # this shape, so pick whichever field is quantitative as the measure.
        encoded_types = [(f, t, _encoding_type_for(t)) for f, t in field_types]
        if any(enc is None for _, _, enc in encoded_types):
            return None
        quantitative = [x for x in encoded_types if x[2] == EncodingType.QUANTITATIVE]
        categorical = [x for x in encoded_types if x[2] != EncodingType.QUANTITATIVE]
        if len(quantitative) != 1 or len(categorical) != 1:
            return None  # part-to-whole needs exactly one category and one measure
        category_field, _, category_enc = categorical[0]
        measure_field, _, measure_enc = quantitative[0]

        encoding.color = Encoding(field=category_field, type=category_enc)
        encoding.size = Encoding(field=measure_field, type=measure_enc, aggregation="sum")
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

        # Chart types requiring a third (color) encoding -- stacked_bar, stacked_bar_horizontal,
        # heatmap, bubble -- aren't generated here: the deterministic Story pipeline only ever
        # carries a 1-2 field pair, and validate_spec() would correctly reject a 3-encoding
        # chart type missing its color/size requirement. Those remain manual-studio-only until
        # a 3-field Story path exists.
        aggregatable_charts = {
            "bar", "grouped_bar", "horizontal_bar", "sorted_bar",
            "line", "area", "sparkline", "waterfall",
        }
        is_aggregatable = y_type == EncodingType.QUANTITATIVE and chart_type in aggregatable_charts
        aggregation = "sum" if is_aggregatable else "none"
        encoding.x = Encoding(field=x_field, type=x_type)
        encoding.y = Encoding(field=y_field, type=y_type, aggregation=aggregation)
    elif len(fields) == 3:
        channel_order = _THREE_FIELD_CHANNEL_ORDER.get(chart_type)
        if channel_order is None:
            return None  # chart type has no known positional mapping for a 3-field Story

        for channel, (field_name, semantic_type) in zip(channel_order, field_types, strict=True):
            enc_type = _encoding_type_for(semantic_type)
            if enc_type is None:
                return None
            # The numeric measure (always last in the detector's fixed field order) gets summed
            # -- it's the thing being cross-tabulated/flowed/nested, matching how the
            # composition/hierarchy/flow detectors computed their own headline numbers.
            aggregation = "sum" if enc_type == EncodingType.QUANTITATIVE else "none"
            setattr(
                encoding, channel,
                Encoding(field=field_name, type=enc_type, aggregation=aggregation),
            )
    else:
        return None

    return VisualizationSpec(
        chart_type=chart_type,
        encoding=encoding,
        typography={"title": title},
        metadata=VisualizationMetadata(
            dataset_id="",
            dataset_version_id=dataset_version_id,
            story_id=story_id,
            generated_by=generated_by,
        ),
    )


def _build_spec_from_gemini(
    rec: ChartRecommendation,
    *,
    column_semantic_types: dict[str, str],
    dataset_version_id: str,
    story_id: str,
) -> VisualizationSpec | None:
    """Builds a VisualizationSpec directly from Gemini's explicit x_field/y_field/color_field/
    aggregate mapping -- no positional inference, since the BI-analyst prompt already assigns
    each field to its channel. Every field is re-checked against the real schema and every
    channel's semantic type is re-derived here (never trusted from the model), exactly like the
    deterministic Story path."""
    fields = [f for f in (rec.x_field, rec.y_field, rec.color_field) if f is not None]
    if not fields or any(f not in column_semantic_types for f in fields):
        return None  # references a field that doesn't exist -- discard, never fabricate

    encoding = Encodings()
    aggregation = Aggregation(rec.aggregate.value) if rec.aggregate else Aggregation.NONE

    if rec.x_field is not None:
        enc_type = _encoding_type_for(column_semantic_types.get(rec.x_field))
        if enc_type is None:
            return None
        encoding.x = Encoding(field=rec.x_field, type=enc_type)

    if rec.y_field is not None:
        enc_type = _encoding_type_for(column_semantic_types.get(rec.y_field))
        if enc_type is None:
            return None
        is_measure = enc_type == EncodingType.QUANTITATIVE
        encoding.y = Encoding(
            field=rec.y_field, type=enc_type, aggregation=aggregation if is_measure else Aggregation.NONE
        )

    if rec.color_field is not None:
        enc_type = _encoding_type_for(column_semantic_types.get(rec.color_field))
        if enc_type is None:
            return None
        encoding.color = Encoding(field=rec.color_field, type=enc_type)

    # Part-to-whole charts encode via color+size, not x/y -- the prompt asks Gemini for the
    # category on color_field and the measure on y_field, but it sometimes puts the category on
    # x_field instead (observed live); remap whichever of x/color actually holds the category.
    if rec.chart_type in _TWO_FIELD_CHANNEL_ORDER and encoding.y is not None:
        encoding.size = Encoding(
            field=encoding.y.field, type=encoding.y.type, aggregation=aggregation
        )
        encoding.y = None
        if encoding.color is None and encoding.x is not None:
            encoding.color = encoding.x
            encoding.x = None

    if encoding.x is None and encoding.y is None and encoding.color is None:
        return None

    return VisualizationSpec(
        chart_type=rec.chart_type,
        encoding=encoding,
        typography={"title": rec.title},
        metadata=VisualizationMetadata(
            dataset_id="",
            dataset_version_id=dataset_version_id,
            story_id=story_id,
            generated_by="gemini",
            reasoning=rec.reason,
        ),
    )


def _redundancy_key(spec: VisualizationSpec) -> tuple:
    """Keyed on (chart family, full field-set): a bar chart and a line chart over the same two
    fields answer the same analytical question, so orientation/mark-only variants within a
    family collide (per the "Bar vs Horizontal Bar vs Lollipop" guidance). Chart types *not*
    grouped into a family (stacked_bar/heatmap/marimekko, treemap/sunburst/decomposition_tree,
    sankey/network/chord) stay distinct even when they read the same fields, because they
    emphasize genuinely different things -- a heatmap's intensity pattern and a stacked bar's
    absolute-value breakdown are not "the same chart in a different skin."

    Every set channel is considered, not just x/y -- a 3-field spec built from the
    hierarchy/flow detectors mostly uses detail/color/size, so an x/y-only key would collapse
    every one of them to the same empty key and wrongly dedupe unrelated specs."""
    fields = tuple(
        sorted(
            enc.field
            for enc in (
                spec.encoding.x, spec.encoding.y, spec.encoding.color,
                spec.encoding.size, spec.encoding.detail,
            )
            if enc is not None
        )
    )
    family = _CHART_FAMILY.get(spec.chart_type, spec.chart_type)
    return (family, fields)


def generate_recommendations(
    stories: list[Story],
    column_semantic_types: dict[str, str],
    dataset_version_id: str,
    ai_findings: list[AnalyticalFinding] | None = None,
    gemini_chart_recommendations: list[ChartRecommendation] | None = None,
) -> list[VisualizationRecommendation]:
    """AI-first priority: valid Gemini-sourced candidates (the explicit chart-recommendation
    engine, then the advisory findings engine) always rank above deterministic Story-derived
    ones. Every AI-derived field reference is re-validated against the real schema here, exactly
    like a Story-derived one, so a hallucinated column can never reach the user -- but once
    validated, a Gemini candidate is never outranked or dedup-evicted by a Story candidate.
    Deterministic Stories only fill remaining slots once every valid Gemini candidate has a
    seat -- see truncate_to_top() for the top-8 cutoff this ordering feeds into."""
    seen_keys: set[tuple] = set()
    ai_tier: list[VisualizationRecommendation] = []
    deterministic_tier: list[VisualizationRecommendation] = []

    for rec in gemini_chart_recommendations or []:
        spec = _build_spec_from_gemini(
            rec,
            column_semantic_types=column_semantic_types,
            dataset_version_id=dataset_version_id,
            story_id=f"gemini-chart:{rec.rank}",
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

        ai_tier.append(
            VisualizationRecommendation(
                story_id=f"gemini-chart:{rec.rank}",
                title=rec.title,
                description=rec.description,
                spec=spec,
                confidence=rec.confidence,
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
            generated_by="gemini",
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

        ai_tier.append(
            VisualizationRecommendation(
                story_id=f"ai-finding:{index}",
                title=finding.description,
                description=f"AI-identified {finding.type.value}: {finding.description}",
                spec=spec,
                confidence=finding.confidence,
            )
        )

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

        deterministic_tier.append(
            VisualizationRecommendation(
                story_id=str(story.id),
                title=story.title,
                description=story.description,
                spec=spec,
                confidence=story.confidence,
            )
        )

    ai_tier.sort(key=lambda r: r.confidence, reverse=True)
    deterministic_tier.sort(key=lambda r: r.confidence, reverse=True)
    return ai_tier + deterministic_tier


MAX_RECOMMENDATIONS = 8


def truncate_to_top(
    recommendations: list[VisualizationRecommendation], *, top_n: int = MAX_RECOMMENDATIONS
) -> list[VisualizationRecommendation]:
    """Hard cap -- never return more than `top_n` recommendations. No "Explore more" overflow
    list: a dataset either supports up to `top_n` meaningfully-different charts or fewer."""
    return recommendations[:top_n]


def recommendation_shortfall_reason(count: int, *, top_n: int = MAX_RECOMMENDATIONS) -> str | None:
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
