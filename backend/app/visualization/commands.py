"""VisualizationCommand: the extension point the future AI copilot (Phase 2, not implemented)
will submit through. Today, manual studio edits will apply these same commands -- there is no
separate "AI path" and "manual path," just one deterministic command applicator. A command
never contains code; it names an operation and carries typed parameters, validated by
apply_command before touching the spec. This is why Phase 2 can plug in later without a
renderer/validator rewrite: it only needs to construct a VisualizationCommand, same as the
studio does.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel

from app.visualization.spec import Annotation, Encoding, Filter, SortSpec, VisualizationSpec


class CommandType(StrEnum):
    CHANGE_CHART_TYPE = "change_chart_type"
    CHANGE_FIELD = "change_field"
    CHANGE_AGGREGATION = "change_aggregation"
    CHANGE_THEME = "change_theme"
    ADD_ANNOTATION = "add_annotation"
    REMOVE_ANNOTATION = "remove_annotation"
    FILTER_DATA = "filter_data"
    REMOVE_FILTER = "remove_filter"
    CHANGE_SORT = "change_sort"
    CHANGE_LAYOUT = "change_layout"


class VisualizationCommand(BaseModel):
    type: CommandType
    params: dict


class CommandError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def apply_command(spec: VisualizationSpec, command: VisualizationCommand) -> VisualizationSpec:
    """Returns a new VisualizationSpec -- never mutates the input, matching the immutable
    version-chain pattern used everywhere else (DatasetVersion, VisualizationVersion)."""
    updated = spec.model_copy(deep=True)

    if command.type == CommandType.CHANGE_CHART_TYPE:
        chart_type = command.params.get("chart_type")
        if not chart_type:
            raise CommandError("change_chart_type requires 'chart_type'")
        updated.chart_type = chart_type

    elif command.type == CommandType.CHANGE_FIELD:
        channel = command.params.get("channel")
        field_name = command.params.get("field")
        encoding_type = command.params.get("encoding_type")
        if channel not in {"x", "y", "color", "size", "detail"}:
            raise CommandError(f"Unknown encoding channel: {channel}")
        if not field_name or not encoding_type:
            raise CommandError("change_field requires 'field' and 'encoding_type'")
        setattr(updated.encoding, channel, Encoding(field=field_name, type=encoding_type))

    elif command.type == CommandType.CHANGE_AGGREGATION:
        channel = command.params.get("channel")
        aggregation = command.params.get("aggregation")
        encoding = getattr(updated.encoding, channel, None) if channel else None
        if encoding is None:
            raise CommandError(f"No encoding set on channel '{channel}' to aggregate")
        encoding.aggregation = aggregation

    elif command.type == CommandType.CHANGE_THEME:
        theme = command.params.get("theme")
        if not theme:
            raise CommandError("change_theme requires 'theme'")
        updated.theme = theme

    elif command.type == CommandType.ADD_ANNOTATION:
        annotation = Annotation.model_validate(command.params)
        updated.annotations = [*updated.annotations, annotation]

    elif command.type == CommandType.REMOVE_ANNOTATION:
        annotation_id = command.params.get("id")
        updated.annotations = [a for a in updated.annotations if a.id != annotation_id]

    elif command.type == CommandType.CHANGE_SORT:
        field_name = command.params.get("field")
        descending = command.params.get("descending", False)
        if not field_name:
            raise CommandError("change_sort requires 'field'")
        updated.sort = SortSpec(field=field_name, descending=descending)

    elif command.type == CommandType.CHANGE_LAYOUT:
        for key, value in command.params.items():
            if not hasattr(updated.layout, key):
                raise CommandError(f"Unknown layout property: {key}")
            setattr(updated.layout, key, value)

    elif command.type == CommandType.FILTER_DATA:
        updated.filters = [*updated.filters, Filter.model_validate(command.params)]

    elif command.type == CommandType.REMOVE_FILTER:
        filter_id = command.params.get("id")
        updated.filters = [f for f in updated.filters if f.id != filter_id]

    else:
        raise CommandError(f"Unsupported command type: {command.type}")

    return updated
