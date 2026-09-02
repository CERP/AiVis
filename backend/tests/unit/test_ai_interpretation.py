import uuid

import pytest

from app.ai.base import AIProvider, AIProviderError
from app.ai.schemas import DatasetInterpretation
from app.schemas.profile import ColumnProfileResponse, DatasetProfileResponse
from app.services.ai_interpretation import interpret_dataset

pytestmark = pytest.mark.asyncio


class FakeProvider(AIProvider):
    def __init__(self, response: DatasetInterpretation | None = None, fail: bool = False):
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


def _profile() -> DatasetProfileResponse:
    return DatasetProfileResponse(
        dataset_version_id=uuid.uuid4(),
        row_count=100,
        column_count=2,
        columns=[
            ColumnProfileResponse(
                id=uuid.uuid4(),
                name="revenue",
                ordinal=0,
                raw_type="Float64",
                semantic_type="currency",
                is_pii=False,
                null_count=0,
                unique_count=90,
                stats={"mean": 100.0},
            ),
            ColumnProfileResponse(
                id=uuid.uuid4(),
                name="email",
                ordinal=1,
                raw_type="Utf8",
                semantic_type="text",
                is_pii=True,
                null_count=0,
                unique_count=100,
                stats={},
            ),
        ],
    )


async def test_interpret_dataset_returns_validated_schema() -> None:
    expected = DatasetInterpretation(
        summary="Sales records",
        likely_domain="e-commerce",
        notable_columns=["revenue"],
        confidence=0.9,
    )
    provider = FakeProvider(response=expected)

    result = await interpret_dataset(provider, _profile())

    assert result == expected
    # email is PII: its name may appear in redacted_column_names for context, but its
    # stats/semantic_type must never be sent as a regular column entry.
    assert '"redacted_column_names":["email"]' in provider.last_prompt
    assert '"name":"email"' not in provider.last_prompt
    assert '"name":"revenue"' in provider.last_prompt


async def test_interpret_dataset_propagates_provider_error() -> None:
    provider = FakeProvider(fail=True)

    with pytest.raises(AIProviderError):
        await interpret_dataset(provider, _profile())
