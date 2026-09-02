import uuid

from app.ai.context_builder import build_dataset_summary
from app.schemas.profile import ColumnProfileResponse, DatasetProfileResponse


def _column(name: str, is_pii: bool, semantic_type: str = "text") -> ColumnProfileResponse:
    return ColumnProfileResponse(
        id=uuid.uuid4(),
        name=name,
        ordinal=0,
        raw_type="Utf8",
        semantic_type=semantic_type,
        is_pii=is_pii,
        null_count=0,
        unique_count=5,
        stats={"top_values": {"a": 3}},
    )


def test_pii_columns_are_redacted_not_sent() -> None:
    profile = DatasetProfileResponse(
        dataset_version_id=uuid.uuid4(),
        row_count=10,
        column_count=2,
        columns=[
            _column("email", is_pii=True),
            _column("region", is_pii=False, semantic_type="geographic"),
        ],
    )

    summary = build_dataset_summary(profile)

    assert summary.redacted_column_names == ["email"]
    sent_names = {c.name for c in summary.columns}
    assert sent_names == {"region"}


def test_null_ratio_computed_from_row_count() -> None:
    col = _column("region", is_pii=False)
    col.null_count = 5
    profile = DatasetProfileResponse(
        dataset_version_id=uuid.uuid4(), row_count=10, column_count=1, columns=[col]
    )

    summary = build_dataset_summary(profile)
    assert summary.columns[0].null_ratio == 0.5


def test_no_row_level_data_in_summary() -> None:
    """The summary must never carry a 'sample_rows' or similar row-level field — only
    schema + aggregate stats. This test locks that contract at the type level."""
    profile = DatasetProfileResponse(
        dataset_version_id=uuid.uuid4(),
        row_count=1,
        column_count=1,
        columns=[_column("region", is_pii=False)],
    )
    summary = build_dataset_summary(profile)
    dumped = summary.model_dump()
    assert "sample_rows" not in dumped
    assert "rows" not in dumped
