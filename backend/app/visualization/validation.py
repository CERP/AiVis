"""Validates a VisualizationSpec against the dataset it claims to visualize -- referenced
fields must exist, and their semantic type must be compatible with the encoding type
requested. This runs before every render; a renderer must never receive an unvalidated spec.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.visualization.registry import ALL_KNOWN_CHART_TYPES, IMPLEMENTED_CHART_TYPES
from app.visualization.spec import Encoding, EncodingType, VisualizationSpec

# The compatibility engine's core: which encoding channels a chart type *requires* to be a
# coherent visualization at all -- e.g. a heatmap without a color encoding isn't a heatmap.
# Mirrors `frontend/src/lib/visualization/registry.ts`'s `requiredEncodings` for every
# implemented chart type. Chart types not listed here fall back to no additional requirement
# (the per-encoding semantic-type check below still applies to whatever *is* present).
REQUIRED_ENCODINGS: dict[str, tuple[str, ...]] = {
    "bar": ("x", "y"),
    "stacked_bar": ("x", "y", "color"),
    "horizontal_bar": ("x", "y"),
    "stacked_bar_horizontal": ("x", "y", "color"),
    "grouped_bar": ("x", "y", "color"),
    "sorted_bar": ("x", "y"),
    "line": ("x", "y"),
    "area": ("x", "y"),
    "sparkline": ("x", "y"),
    "waterfall": ("x", "y"),
    "histogram": ("x",),
    "box_plot": ("x", "y"),
    "scatter": ("x", "y"),
    "bubble": ("x", "y", "size"),
    "heatmap": ("x", "y", "color"),
    "donut": ("color", "size"),
    "pie": ("color", "size"),
    "kpi": ("size",),
    # --- Added when the remaining chart types were implemented ---
    "lollipop": ("x", "y"),
    "bullet": ("x", "y"),
    "bump": ("x", "y", "color"),
    "ribbon": ("x", "y", "color"),
    "marimekko": ("x", "y", "size"),
    "gantt": ("x", "x2", "y"),
    "candlestick": ("x", "open", "high", "low", "close"),
    "ohlc": ("x", "open", "high", "low", "close"),
    "line_column": ("x", "y", "measure2"),
    "treemap": ("detail", "size"),
    "sunburst": ("detail", "size"),
    "decomposition_tree": ("detail", "size"),
    "network": ("x", "y", "size"),
    "chord": ("x", "y", "size"),
    "sankey": ("x", "y", "size"),
    "flow_map": ("x", "y", "size"),
    "violin": ("x", "y"),
    "funnel": ("x", "y"),
    "gauge": ("size",),
    "radar": ("x", "y", "color"),
    "choropleth": ("x", "color"),
    "bubble_map": ("x", "y", "size"),
    "matrix": ("x", "y", "size"),
}

# Channels that must appear together or not at all -- a partially-specified OHLC set is never
# a valid chart, it's a half-configured one, and rendering it would silently drop a price.
_CHANNEL_GROUPS: tuple[tuple[str, ...], ...] = (("open", "high", "low", "close"),)

_SEMANTIC_TO_COMPATIBLE_ENCODINGS: dict[str, set[EncodingType]] = {
    "numeric": {EncodingType.QUANTITATIVE, EncodingType.ORDINAL},
    "currency": {EncodingType.QUANTITATIVE, EncodingType.ORDINAL},
    "identifier": {EncodingType.NOMINAL, EncodingType.ORDINAL},
    "categorical": {EncodingType.NOMINAL, EncodingType.ORDINAL},
    "geographic": {EncodingType.NOMINAL, EncodingType.ORDINAL},
    "text": {EncodingType.NOMINAL},
    "boolean": {EncodingType.NOMINAL, EncodingType.ORDINAL},
    "date": {EncodingType.TEMPORAL, EncodingType.ORDINAL},
}


@dataclass
class ValidationResult:
    is_valid: bool
    errors: list[str] = field(default_factory=list)


def validate_spec(
    spec: VisualizationSpec, column_semantic_types: dict[str, str]
) -> ValidationResult:
    errors: list[str] = []

    if spec.chart_type not in ALL_KNOWN_CHART_TYPES:
        errors.append(f"Unknown chart type '{spec.chart_type}'")
    elif spec.chart_type not in IMPLEMENTED_CHART_TYPES:
        errors.append(f"Chart type '{spec.chart_type}' is not implemented yet")

    encoding_by_channel: dict[str, Encoding | None] = {
        "x": spec.encoding.x,
        "y": spec.encoding.y,
        "color": spec.encoding.color,
        "size": spec.encoding.size,
        "detail": spec.encoding.detail,
        "x2": spec.encoding.x2,
        "y2": spec.encoding.y2,
        "measure2": spec.encoding.measure2,
        "open": spec.encoding.open,
        "high": spec.encoding.high,
        "low": spec.encoding.low,
        "close": spec.encoding.close,
    }

    for channel in REQUIRED_ENCODINGS.get(spec.chart_type, ()):
        if encoding_by_channel.get(channel) is None:
            errors.append(f"Chart type '{spec.chart_type}' requires a '{channel}' encoding")

    for group in _CHANNEL_GROUPS:
        present = [c for c in group if encoding_by_channel.get(c) is not None]
        if present and len(present) != len(group):
            missing = ", ".join(c for c in group if c not in present)
            errors.append(
                f"Channels ({', '.join(group)}) must be set together; missing: {missing}"
            )

    encodings: list[tuple[str, Encoding | None]] = list(encoding_by_channel.items())

    for channel, encoding in encodings:
        if encoding is None:
            continue
        semantic_type = column_semantic_types.get(encoding.field)
        if semantic_type is None:
            errors.append(f"Encoding '{channel}' references unknown field '{encoding.field}'")
            continue
        compatible = _SEMANTIC_TO_COMPATIBLE_ENCODINGS.get(semantic_type, set())
        if encoding.type not in compatible:
            errors.append(
                f"Encoding '{channel}' field '{encoding.field}' (semantic type "
                f"'{semantic_type}') is not compatible with encoding type '{encoding.type}'"
            )

    for filt in spec.filters:
        if filt.field not in column_semantic_types:
            errors.append(f"Filter references unknown field '{filt.field}'")

    if spec.sort is not None and spec.sort.field not in column_semantic_types:
        errors.append(f"Sort references unknown field '{spec.sort.field}'")

    return ValidationResult(is_valid=len(errors) == 0, errors=errors)
