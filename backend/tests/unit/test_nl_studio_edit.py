"""Natural-language studio edits: Gemini translates free text into a strictly-typed
StudioEditCommand, which is then mapped onto the exact same VisualizationCommand shape a manual
studio control produces. These tests cover the translation layer -- schema validation, the
command_type -> params mapping for each supported edit, and provider-error propagation."""

import pytest
from pydantic import ValidationError

from app.ai.base import AIProvider, AIProviderError
from app.ai.schemas import StudioEditCommand, StudioEditCommandType
from app.services.nl_studio_edit import analyze_nl_studio_edit, to_visualization_command
from app.visualization.commands import CommandType
from app.visualization.spec import (
    Encoding,
    Encodings,
    EncodingType,
    VisualizationMetadata,
    VisualizationSpec,
)

_SEMANTIC_TYPES = {"revenue": "currency", "region": "categorical"}


def _spec() -> VisualizationSpec:
    return VisualizationSpec(
        chart_type="bar",
        encoding=Encodings(
            x=Encoding(field="region", type=EncodingType.NOMINAL),
            y=Encoding(field="revenue", type=EncodingType.QUANTITATIVE, aggregation="sum"),
        ),
        metadata=VisualizationMetadata(dataset_id="d1", dataset_version_id="v1"),
    )


class FakeProvider(AIProvider):
    def __init__(self, response: StudioEditCommand | None = None, fail: bool = False):
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


@pytest.mark.asyncio
async def test_analyze_nl_studio_edit_returns_validated_schema() -> None:
    expected = StudioEditCommand(
        command_type=StudioEditCommandType.CHANGE_AGGREGATION,
        channel="y",
        aggregation="median",
        explanation="Switched the y-axis aggregation to median.",
    )
    provider = FakeProvider(response=expected)

    result = await analyze_nl_studio_edit(
        provider,
        spec=_spec(),
        column_semantic_types=_SEMANTIC_TYPES,
        query="change y-axis aggregation to median",
    )

    assert result == expected
    assert "change y-axis aggregation to median" in provider.last_prompt


@pytest.mark.asyncio
async def test_analyze_nl_studio_edit_propagates_provider_error() -> None:
    provider = FakeProvider(fail=True)
    with pytest.raises(AIProviderError):
        await analyze_nl_studio_edit(
            provider, spec=_spec(), column_semantic_types=_SEMANTIC_TYPES, query="anything"
        )


def test_studio_edit_command_rejects_invalid_command_type() -> None:
    with pytest.raises(ValidationError):
        StudioEditCommand(command_type="not_a_real_type", explanation="x")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("edit", "expected_type", "expected_params"),
    [
        (
            StudioEditCommand(
                command_type=StudioEditCommandType.CHANGE_CHART_TYPE,
                chart_type="line",
                explanation="x",
            ),
            CommandType.CHANGE_CHART_TYPE,
            {"chart_type": "line"},
        ),
        (
            StudioEditCommand(
                command_type=StudioEditCommandType.CHANGE_FIELD,
                channel="color",
                field="region",
                encoding_type="nominal",
                explanation="x",
            ),
            CommandType.CHANGE_FIELD,
            {"channel": "color", "field": "region", "encoding_type": "nominal"},
        ),
        (
            StudioEditCommand(
                command_type=StudioEditCommandType.CHANGE_AGGREGATION,
                channel="y",
                aggregation="median",
                explanation="x",
            ),
            CommandType.CHANGE_AGGREGATION,
            {"channel": "y", "aggregation": "median"},
        ),
        (
            StudioEditCommand(
                command_type=StudioEditCommandType.CHANGE_THEME,
                theme="dark_data",
                explanation="x",
            ),
            CommandType.CHANGE_THEME,
            {"theme": "dark_data"},
        ),
        (
            StudioEditCommand(
                command_type=StudioEditCommandType.CHANGE_SORT,
                field="revenue",
                sort_descending=True,
                explanation="x",
            ),
            CommandType.CHANGE_SORT,
            {"field": "revenue", "descending": True},
        ),
    ],
)
def test_to_visualization_command_maps_each_supported_edit(
    edit: StudioEditCommand, expected_type: CommandType, expected_params: dict
) -> None:
    command = to_visualization_command(edit)
    assert command.type == expected_type
    assert command.params == expected_params
