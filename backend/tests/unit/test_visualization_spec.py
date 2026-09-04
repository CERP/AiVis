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


def test_validation_rejects_unknown_chart_type() -> None:
    """No backend chart-type registry existed before this audit -- validate_spec() checked
    field/encoding compatibility but never checked whether chart_type was a real chart at all.
    A bogus or AI-hallucinated chart_type could previously pass validation entirely."""
    spec = VisualizationSpec(
        chart_type="made_up_chart_type",
        encoding=Encodings(x=Encoding(field="region", type=EncodingType.NOMINAL)),
        metadata=VisualizationMetadata(dataset_id="d1", dataset_version_id="v1"),
    )
    result = validate_spec(spec, {"region": "categorical"})
    assert not result.is_valid
    assert any("Unknown chart type" in e for e in result.errors)


def test_every_registered_chart_type_is_implemented() -> None:
    """The whole 41-type library now has a real renderer, so nothing should be sitting in the
    registry as a not-yet-implemented placeholder. The `not implemented yet` guard in
    validate_spec() stays in place for any future type added ahead of its renderer."""
    from app.visualization.registry import PLANNED_CHART_TYPES

    assert PLANNED_CHART_TYPES == frozenset()


def test_treemap_now_validates_with_its_required_encodings() -> None:
    spec = VisualizationSpec(
        chart_type="treemap",
        encoding=Encodings(
            detail=Encoding(field="region", type=EncodingType.NOMINAL),
            size=Encoding(field="revenue", type=EncodingType.QUANTITATIVE),
        ),
        metadata=VisualizationMetadata(dataset_id="d1", dataset_version_id="v1"),
    )
    result = validate_spec(spec, {"region": "categorical", "revenue": "currency"})
    assert result.is_valid, result.errors


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
