"""Gemini's explicit x_field/y_field/color_field/aggregate chart recommendations are advisory
input to the deterministic recommendation engine -- these tests cover the same failure modes as
test_recommendation_ai_findings.py, for the explicit-channel path: a hallucinated field or an
unimplemented/incompatible chart type must never reach a recommendation, and the result is
always hard-capped at 8."""

import pytest
from pydantic import ValidationError

import uuid

from app.ai.base import AIProvider, AIProviderError
from app.ai.context_builder import AnalysisContext, DatasetSummary
from app.ai.schemas import Aggregate, ChartRecommendation, ChartRecommendations
from app.models.insight import Story
from app.services.chart_recommendations import (
    _SYSTEM_INSTRUCTION,
    analyze_chart_recommendations,
)
from app.visualization.recommendation import generate_recommendations, truncate_to_top

_SEMANTIC_TYPES = {"revenue": "currency", "units": "numeric", "region": "categorical"}


def _story(fields: list[str], chart_type: str = "bar", confidence: float = 0.99) -> Story:
    return Story(
        dataset_version_id=uuid.uuid4(),
        title="Revenue by region",
        description="desc",
        analytical_question="Which region leads on revenue?",
        relevant_fields=fields,
        recommended_chart_type=chart_type,
        confidence=confidence,
    )


def _rec(**overrides) -> ChartRecommendation:
    defaults = dict(
        rank=1,
        chart_type="bar",
        title="Revenue by region",
        description="desc",
        reason="categorical dimension vs numeric measure",
        x_field="region",
        y_field="revenue",
        color_field=None,
        aggregate=Aggregate.SUM,
        confidence=0.9,
    )
    defaults.update(overrides)
    return ChartRecommendation(**defaults)


class FakeProvider(AIProvider):
    def __init__(self, response: ChartRecommendations | None = None, fail: bool = False):
        self._response = response
        self._fail = fail
        self.last_prompt: str | None = None
        self.last_system_instruction: str | None = None

    async def generate_structured(self, *, system_instruction, prompt, response_schema):
        self.last_prompt = prompt
        self.last_system_instruction = system_instruction
        if self._fail:
            raise AIProviderError("simulated failure")
        assert self._response is not None
        return self._response


def _context() -> AnalysisContext:
    return AnalysisContext(
        dataset=DatasetSummary(row_count=100, column_count=2, columns=[], redacted_column_names=[]),
        data_quality_score=90,
        data_quality_issues=[],
        detected_relationships=[],
        time_dimensions=[],
        geographic_dimensions=[],
    )


@pytest.mark.asyncio
async def test_analyze_chart_recommendations_returns_validated_schema() -> None:
    expected = ChartRecommendations(recommendations=[_rec()])
    provider = FakeProvider(response=expected)

    result = await analyze_chart_recommendations(provider, _context())

    assert result == expected
    assert provider.last_system_instruction == _SYSTEM_INSTRUCTION


@pytest.mark.asyncio
async def test_analyze_chart_recommendations_propagates_provider_error() -> None:
    provider = FakeProvider(fail=True)
    with pytest.raises(AIProviderError):
        await analyze_chart_recommendations(provider, _context())


def test_chart_recommendation_rejects_rank_out_of_range() -> None:
    with pytest.raises(ValidationError):
        _rec(rank=9)


def test_chart_recommendations_list_rejects_more_than_eight() -> None:
    with pytest.raises(ValidationError):
        ChartRecommendations(recommendations=[_rec(rank=1) for _ in range(9)])


def test_gemini_chart_rec_with_hallucinated_field_is_discarded() -> None:
    rec = _rec(x_field="made_up_column")
    recs = generate_recommendations(
        [], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=[rec]
    )
    assert recs == []


def test_gemini_chart_rec_scatter_with_categorical_axis_is_rejected() -> None:
    rec = _rec(
        chart_type="scatter", x_field="region", y_field="revenue", aggregate=None
    )
    recs = generate_recommendations(
        [], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=[rec]
    )
    assert recs == []


def test_gemini_chart_rec_valid_scatter_is_accepted() -> None:
    rec = _rec(
        chart_type="scatter", x_field="units", y_field="revenue", aggregate=None
    )
    recs = generate_recommendations(
        [], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=[rec]
    )
    assert len(recs) == 1


def test_gemini_donut_with_category_on_x_field_is_remapped_to_color() -> None:
    """Observed live: Gemini sometimes puts a part-to-whole chart's category on x_field instead
    of color_field. donut/pie require color+size, not x -- this must be remapped, not dropped."""
    rec = _rec(
        chart_type="donut", x_field="region", y_field="revenue", color_field=None, aggregate=Aggregate.SUM
    )
    recs = generate_recommendations(
        [], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=[rec]
    )
    assert len(recs) == 1
    assert recs[0].spec.encoding.x is None
    assert recs[0].spec.encoding.color.field == "region"
    assert recs[0].spec.encoding.size.field == "revenue"


def test_gemini_chart_rec_spec_carries_provenance_metadata() -> None:
    """Every Gemini-sourced spec must be traceable back to the model and carry its stated
    reasoning -- never indistinguishable from a deterministic Story-derived chart."""
    rec = _rec(
        chart_type="scatter",
        x_field="units",
        y_field="revenue",
        aggregate=None,
        reason="units and revenue are both continuous measures worth correlating",
    )
    recs = generate_recommendations(
        [], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=[rec]
    )
    assert recs[0].spec.metadata.generated_by == "gemini"
    assert recs[0].spec.metadata.reasoning == (
        "units and revenue are both continuous measures worth correlating"
    )
    assert recs[0].spec.encoding.x.field == "units"
    assert recs[0].spec.encoding.y.field == "revenue"


def test_gemini_candidates_outrank_higher_confidence_story_candidates() -> None:
    """AI-first priority: a valid Gemini candidate must rank above ALL deterministic Story
    candidates, even when a Story has higher raw confidence -- this is a tiered ordering, not a
    single global confidence sort."""
    high_confidence_story = _story(["region", "revenue"], chart_type="bar", confidence=0.99)
    low_confidence_gemini = _rec(
        chart_type="scatter", x_field="units", y_field="revenue", aggregate=None, confidence=0.3
    )
    recs = generate_recommendations(
        [high_confidence_story], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=[low_confidence_gemini]
    )
    assert recs[0].spec.metadata.generated_by == "gemini"
    assert recs[1].story_id == str(high_confidence_story.id)


def test_stories_backfill_only_after_all_valid_gemini_candidates() -> None:
    """When Gemini returns fewer than 8 valid candidates, deterministic Stories fill the
    remaining slots -- but never displace a Gemini candidate that already has a seat."""
    gemini_rec = _rec(
        chart_type="scatter", x_field="units", y_field="revenue", aggregate=None, confidence=0.4
    )
    story = _story(["region", "revenue"], chart_type="donut", confidence=0.9)
    recs = generate_recommendations(
        [story], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=[gemini_rec]
    )
    top = truncate_to_top(recs)
    assert len(top) == 2
    assert top[0].spec.metadata.generated_by == "gemini"
    assert top[1].spec.metadata.generated_by == "deterministic"


def test_gemini_chart_recs_never_exceed_eight_after_truncation() -> None:
    recs_in = [
        _rec(rank=i, x_field="region", y_field="revenue", color_field=None, confidence=0.5)
        for i in range(1, 9)
    ] + [_rec(rank=1, chart_type="scatter", x_field="units", y_field="revenue", aggregate=None)]
    recs = generate_recommendations(
        [], _SEMANTIC_TYPES, "v1", gemini_chart_recommendations=recs_in
    )
    top = truncate_to_top(recs)
    assert len(top) <= 8
