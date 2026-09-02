"""Validates a VisualizationSpec against the dataset it claims to visualize -- referenced
fields must exist, and their semantic type must be compatible with the encoding type
requested. This runs before every render; a renderer must never receive an unvalidated spec.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.visualization.spec import Encoding, EncodingType, VisualizationSpec

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

    encodings: list[tuple[str, Encoding | None]] = [
        ("x", spec.encoding.x),
        ("y", spec.encoding.y),
        ("color", spec.encoding.color),
        ("size", spec.encoding.size),
        ("detail", spec.encoding.detail),
    ]

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
