import pytest

from app.visualization.commands import (
    CommandError,
    CommandType,
    VisualizationCommand,
    apply_command,
)
from app.visualization.spec import (
    Encoding,
    Encodings,
    EncodingType,
    VisualizationMetadata,
    VisualizationSpec,
)
from app.visualization.validation import validate_spec


def _spec() -> VisualizationSpec:
    return VisualizationSpec(
        chart_type="bar",
        encoding=Encodings(
            x=Encoding(field="region", type=EncodingType.NOMINAL),
            y=Encoding(field="revenue", type=EncodingType.QUANTITATIVE),
        ),
        metadata=VisualizationMetadata(dataset_id="d1", dataset_version_id="v1"),
    )


def test_valid_spec_passes_validation() -> None:
    spec = _spec()
    result = validate_spec(spec, {"region": "categorical", "revenue": "currency"})
    assert result.is_valid
    assert result.errors == []


def test_validation_rejects_unknown_field() -> None:
    spec = _spec()
    result = validate_spec(spec, {"revenue": "currency"})
    assert not result.is_valid
    assert any("region" in e for e in result.errors)


def test_validation_rejects_incompatible_encoding_type() -> None:
    spec = VisualizationSpec(
        chart_type="line",
        encoding=Encodings(x=Encoding(field="revenue", type=EncodingType.TEMPORAL)),
        metadata=VisualizationMetadata(dataset_id="d1", dataset_version_id="v1"),
    )
    result = validate_spec(spec, {"revenue": "currency"})
    assert not result.is_valid
    assert any("not compatible" in e for e in result.errors)


def test_apply_command_change_chart_type_does_not_mutate_original() -> None:
    spec = _spec()
    command = VisualizationCommand(
        type=CommandType.CHANGE_CHART_TYPE, params={"chart_type": "line"}
    )

    new_spec = apply_command(spec, command)

    assert new_spec.chart_type == "line"
    assert spec.chart_type == "bar"  # original untouched


def test_apply_command_add_and_remove_annotation() -> None:
    spec = _spec()
    add_command = VisualizationCommand(
        type=CommandType.ADD_ANNOTATION,
        params={"id": "a1", "type": "callout", "text": "Peak revenue"},
    )
    with_annotation = apply_command(spec, add_command)
    assert len(with_annotation.annotations) == 1

    remove_command = VisualizationCommand(type=CommandType.REMOVE_ANNOTATION, params={"id": "a1"})
    without_annotation = apply_command(with_annotation, remove_command)
    assert len(without_annotation.annotations) == 0


def test_apply_command_change_field() -> None:
    spec = _spec()
    command = VisualizationCommand(
        type=CommandType.CHANGE_FIELD,
        params={"channel": "x", "field": "product", "encoding_type": "nominal"},
    )
    new_spec = apply_command(spec, command)
    assert new_spec.encoding.x.field == "product"


def test_apply_command_raises_on_unknown_channel() -> None:
    spec = _spec()
    command = VisualizationCommand(
        type=CommandType.CHANGE_FIELD,
        params={"channel": "not_a_channel", "field": "product", "encoding_type": "nominal"},
    )
    with pytest.raises(CommandError):
        apply_command(spec, command)


def test_spec_round_trips_through_json() -> None:
    spec = _spec()
    restored = VisualizationSpec.model_validate_json(spec.model_dump_json())
    assert restored == spec
