"""The compatibility engine (section 48 of the visualization-library audit): every implemented
chart type declares which encoding channels it *requires* to be a coherent visualization, not
just "whatever fields happen to be compatible." A heatmap without a color encoding, or a bubble
chart without a size encoding, isn't that chart type -- these must be rejected, not silently
rendered wrong."""

from app.visualization.spec import Encoding, Encodings, EncodingType, VisualizationMetadata, VisualizationSpec
from app.visualization.validation import validate_spec

_METADATA = VisualizationMetadata(dataset_id="d1", dataset_version_id="v1")


def test_heatmap_without_color_is_rejected() -> None:
    spec = VisualizationSpec(
        chart_type="heatmap",
        encoding=Encodings(
            x=Encoding(field="region", type=EncodingType.NOMINAL),
            y=Encoding(field="product", type=EncodingType.NOMINAL),
        ),
        metadata=_METADATA,
    )
    result = validate_spec(spec, {"region": "categorical", "product": "categorical"})
    assert not result.is_valid
    assert any("requires a 'color' encoding" in e for e in result.errors)


def test_bubble_without_size_is_rejected() -> None:
    spec = VisualizationSpec(
        chart_type="bubble",
        encoding=Encodings(
            x=Encoding(field="revenue", type=EncodingType.QUANTITATIVE),
            y=Encoding(field="units", type=EncodingType.QUANTITATIVE),
        ),
        metadata=_METADATA,
    )
    result = validate_spec(spec, {"revenue": "currency", "units": "numeric"})
    assert not result.is_valid
    assert any("requires a 'size' encoding" in e for e in result.errors)


def test_stacked_bar_without_color_is_rejected() -> None:
    spec = VisualizationSpec(
        chart_type="stacked_bar",
        encoding=Encodings(
            x=Encoding(field="region", type=EncodingType.NOMINAL),
            y=Encoding(field="revenue", type=EncodingType.QUANTITATIVE),
        ),
        metadata=_METADATA,
    )
    result = validate_spec(spec, {"region": "categorical", "revenue": "currency"})
    assert not result.is_valid
    assert any("requires a 'color' encoding" in e for e in result.errors)


def test_complete_heatmap_spec_is_valid() -> None:
    spec = VisualizationSpec(
        chart_type="heatmap",
        encoding=Encodings(
            x=Encoding(field="region", type=EncodingType.NOMINAL),
            y=Encoding(field="product", type=EncodingType.NOMINAL),
            color=Encoding(field="revenue", type=EncodingType.QUANTITATIVE),
        ),
        metadata=_METADATA,
    )
    result = validate_spec(
        spec, {"region": "categorical", "product": "categorical", "revenue": "currency"}
    )
    assert result.is_valid, result.errors


def test_complete_bubble_spec_is_valid() -> None:
    spec = VisualizationSpec(
        chart_type="bubble",
        encoding=Encodings(
            x=Encoding(field="revenue", type=EncodingType.QUANTITATIVE),
            y=Encoding(field="units", type=EncodingType.QUANTITATIVE),
            size=Encoding(field="profit", type=EncodingType.QUANTITATIVE),
        ),
        metadata=_METADATA,
    )
    result = validate_spec(
        spec, {"revenue": "currency", "units": "numeric", "profit": "currency"}
    )
    assert result.is_valid, result.errors


def test_kpi_without_measure_is_rejected() -> None:
    spec = VisualizationSpec(
        chart_type="kpi",
        encoding=Encodings(x=Encoding(field="date", type=EncodingType.TEMPORAL)),
        metadata=_METADATA,
    )
    result = validate_spec(spec, {"date": "date"})
    assert not result.is_valid
    assert any("requires a 'size' encoding" in e for e in result.errors)


def test_new_orientation_and_ranking_chart_types_pass_full_validation() -> None:
    for chart_type in ("horizontal_bar", "sorted_bar", "waterfall", "sparkline"):
        spec = VisualizationSpec(
            chart_type=chart_type,
            encoding=Encodings(
                x=Encoding(field="region", type=EncodingType.NOMINAL),
                y=Encoding(field="revenue", type=EncodingType.QUANTITATIVE, aggregation="sum"),
            ),
            metadata=_METADATA,
        )
        result = validate_spec(spec, {"region": "categorical", "revenue": "currency"})
        assert result.is_valid, f"{chart_type}: {result.errors}"
