import pytest
from pydantic import ValidationError

from app.ai.base import AIProvider, AIProviderError
from app.ai.context_builder import AnalysisContext, DatasetSummary
from app.ai.schemas import AnalyticalFinding, AnalyticalFindings, FindingType
from app.services.ai_findings import analyze_dataset_findings


class FakeProvider(AIProvider):
    def __init__(self, response: AnalyticalFindings | None = None, fail: bool = False):
        self._response = response
        self._fail = fail
        self.last_prompt: str | None = None

    async def generate_structured(self, *, system_instruction, prompt, response_schema):
        self.last_prompt = prompt
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
        time_dimensions=["date"],
        geographic_dimensions=[],
    )


@pytest.mark.asyncio
async def test_analyze_dataset_findings_returns_validated_schema() -> None:
    expected = AnalyticalFindings(
        findings=[
            AnalyticalFinding(
                type=FindingType.RELATIONSHIP,
                fields=["revenue", "units"],
                description="Revenue and units move together",
                confidence=0.8,
                suggested_chart_type="scatter",
            )
        ]
    )
    provider = FakeProvider(response=expected)

    result = await analyze_dataset_findings(provider, _context())

    assert result == expected
    assert '"time_dimensions":["date"]' in provider.last_prompt


@pytest.mark.asyncio
async def test_analyze_dataset_findings_propagates_provider_error() -> None:
    provider = FakeProvider(fail=True)
    with pytest.raises(AIProviderError):
        await analyze_dataset_findings(provider, _context())


def test_finding_rejects_invalid_type() -> None:
    with pytest.raises(ValidationError):
        AnalyticalFinding(
            type="not_a_real_type",  # type: ignore[arg-type]
            fields=["x"],
            description="bad",
            confidence=0.5,
        )


def test_finding_rejects_confidence_out_of_range() -> None:
    with pytest.raises(ValidationError):
        AnalyticalFinding(
            type=FindingType.TREND, fields=["x"], description="bad", confidence=1.5
        )


def test_findings_list_rejects_too_many_entries() -> None:
    findings = [
        AnalyticalFinding(type=FindingType.OTHER, fields=["x"], description="d", confidence=0.5)
        for _ in range(21)
    ]
    with pytest.raises(ValidationError):
        AnalyticalFindings(findings=findings)
