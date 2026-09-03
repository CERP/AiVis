"""AI findings are advisory input to the deterministic recommendation engine -- these tests
cover the specific failure modes section 27 calls out: a hallucinated field must never reach a
recommendation, and a finding that duplicates an existing field-set must be dropped."""

import uuid

from app.ai.schemas import AnalyticalFinding, FindingType
from app.models.insight import Story
from app.visualization.recommendation import generate_recommendations

_SEMANTIC_TYPES = {"revenue": "currency", "units": "numeric", "region": "categorical"}


def _story(fields: list[str], chart_type: str = "bar") -> Story:
    return Story(
        dataset_version_id=uuid.uuid4(),
        title="Revenue by region",
        description="desc",
        analytical_question="Which region leads on revenue?",
        relevant_fields=fields,
        recommended_chart_type=chart_type,
        confidence=0.7,
    )


def test_ai_finding_with_hallucinated_field_is_discarded() -> None:
    finding = AnalyticalFinding(
        type=FindingType.RELATIONSHIP,
        fields=["revenue", "made_up_column"],
        description="bogus",
        confidence=0.9,
    )
    recs = generate_recommendations([], _SEMANTIC_TYPES, "v1", ai_findings=[finding])
    assert recs == []


def test_ai_finding_adds_a_new_candidate_not_covered_by_stories() -> None:
    finding = AnalyticalFinding(
        type=FindingType.RELATIONSHIP,
        fields=["revenue", "units"],
        description="Revenue and units move together",
        confidence=0.85,
        suggested_chart_type="scatter",
    )
    recs = generate_recommendations([], _SEMANTIC_TYPES, "v1", ai_findings=[finding])
    assert len(recs) == 1
    assert recs[0].story_id == "ai-finding:0"
    assert recs[0].spec.chart_type == "scatter"


def test_ai_finding_redundant_with_existing_story_is_dropped() -> None:
    story = _story(["region", "revenue"], chart_type="bar")
    finding = AnalyticalFinding(
        type=FindingType.COMPARISON,
        fields=["revenue", "region"],  # same field-set, different order -- still redundant
        description="Compare revenue across regions",
        confidence=0.95,
        suggested_chart_type="line",
    )
    recs = generate_recommendations([story], _SEMANTIC_TYPES, "v1", ai_findings=[finding])
    assert len(recs) == 1
    assert recs[0].story_id == str(story.id)  # deterministic story wins the redundancy slot


def test_ai_finding_with_unknown_suggested_chart_falls_back_to_bar() -> None:
    finding = AnalyticalFinding(
        type=FindingType.OTHER,
        fields=["revenue", "units"],
        description="something",
        confidence=0.5,
        suggested_chart_type=None,
    )
    recs = generate_recommendations([], _SEMANTIC_TYPES, "v1", ai_findings=[finding])
    assert len(recs) == 1
    assert recs[0].spec.chart_type == "bar"
