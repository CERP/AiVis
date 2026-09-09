import uuid

from app.ai.context_builder import build_analysis_context, build_dataset_summary
from app.insights.data_quality import DataQualityReport
from app.models.insight import Insight, InsightType
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


def test_null_percentage_computed_from_row_count() -> None:
    col = _column("region", is_pii=False)
    col.null_count = 5
    profile = DatasetProfileResponse(
        dataset_version_id=uuid.uuid4(), row_count=10, column_count=1, columns=[col]
    )

    summary = build_dataset_summary(profile)
    assert summary.columns[0].null_percentage == 50.0


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


def test_relationship_evidence_excludes_pii_fields() -> None:
    version_id = uuid.uuid4()
    profile = DatasetProfileResponse(
        dataset_version_id=version_id, row_count=10, column_count=2,
        columns=[_column("email", True), _column("revenue", False, "numeric")],
    )
    insights = [
        Insight(
            dataset_version_id=version_id, type=InsightType.DISTRIBUTION,
            title="Distribution", description="Computed evidence", fields=[name],
            calculation={"median": value},
        )
        for name, value in [("email", "private@example.com"), ("revenue", 12)]
    ]
    context = build_analysis_context(profile, DataQualityReport(score=100), insights)
    assert len(context.detected_relationships) == 1
    assert context.detected_relationships[0].calculation == {"median": 12}
    assert "private@example.com" not in context.model_dump_json()
