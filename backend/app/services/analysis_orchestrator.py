"""AnalysisOrchestrator: the single place that coordinates the automatic pipeline a dataset goes
through after ingestion -- data quality, deterministic insight/story detection, AI context
building, Gemini analysis, recommendation generation, validation, ranking, and persisted preview
snapshotting. The frontend never orchestrates these steps itself; it only uploads a dataset and
polls `GET /api/datasets/{id}/analysis`.

Each stage updates `Analysis.status` and commits immediately, so a poller always sees real
progress. Deterministic sub-steps (insight/story generation) are idempotent -- if a retry finds
they already ran for this dataset version, it reuses the existing rows instead of duplicating
them, which is also what keeps a retry cheap (section 23/24 of the pipeline spec: don't repeat
expensive stages, don't require exact per-stage resume tracking to get that benefit)."""

from __future__ import annotations

import io
from datetime import UTC, datetime

import polars as pl
import pyarrow.parquet as pq
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.base import AIProviderError
from app.ai.context_builder import build_analysis_context
from app.ai.factory import get_ai_provider
from app.ai.schemas import AnalyticalFindings
from app.insights.data_quality import ColumnQualityInput, analyze_data_quality
from app.models.analysis import Analysis, AnalysisStatus
from app.models.dataset import DatasetVersion
from app.repositories.dataset import DataProfileRepository, DatasetColumnRepository
from app.repositories.insight import InsightRepository, StoryRepository
from app.schemas.profile import ColumnProfileResponse, DatasetProfileResponse
from app.schemas.recommendation import VisualizationRecommendationResponse
from app.services.ai_findings import analyze_dataset_findings
from app.services.insight_analysis import analyze_dataset_version
from app.services.storage import get_storage_service
from app.services.story_analysis import generate_stories_for_version
from app.visualization.recommendation import (
    generate_recommendations,
    recommendation_shortfall_reason,
    split_top_and_derived,
)


async def _set_stage(session: AsyncSession, analysis: Analysis, status: AnalysisStatus) -> None:
    analysis.status = status
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)


async def _fail(session: AsyncSession, analysis: Analysis, message: str) -> None:
    # Prefix with the stage that was active when the failure happened -- `status` itself becomes
    # "failed" (a valid lifecycle terminal state), so this is the only place that stage context
    # survives for the retry UI/logs.
    failing_stage = analysis.status.value
    analysis.status = AnalysisStatus.FAILED
    analysis.error = f"[{failing_stage}] {message}"[:2000]
    analysis.completed_at = datetime.now(UTC)
    session.add(analysis)
    await session.commit()


async def _load_dataframe(version: DatasetVersion) -> pl.DataFrame:
    storage = get_storage_service()
    parquet_bytes = storage.download_bytes(storage.bucket_processed, version.parquet_object_key)
    return pl.from_arrow(pq.read_table(io.BytesIO(parquet_bytes)))


async def _build_profile_response(
    session: AsyncSession, version: DatasetVersion
) -> DatasetProfileResponse:
    columns = await DatasetColumnRepository(session).list_for_version(version.id)
    profile_repo = DataProfileRepository(session)

    column_responses: list[ColumnProfileResponse] = []
    for column in columns:
        profile = await profile_repo.get_by_column(column.id)
        column_responses.append(
            ColumnProfileResponse(
                id=column.id,
                name=column.name,
                ordinal=column.ordinal,
                raw_type=column.raw_type,
                semantic_type=column.semantic_type,
                is_pii=column.is_pii,
                null_count=profile.null_count if profile else 0,
                unique_count=profile.unique_count if profile else 0,
                stats=profile.stats if profile else {},
            )
        )

    return DatasetProfileResponse(
        dataset_version_id=version.id,
        row_count=version.row_count,
        column_count=version.column_count,
        columns=column_responses,
    )


async def run_analysis(session: AsyncSession, analysis: Analysis, version: DatasetVersion) -> None:
    """Runs every remaining stage for `analysis`, which the caller has already claimed
    (status=PROFILING_QUALITY, per AnalysisRepository.claim_next_queued). Raises nothing --
    any failure is captured on the Analysis row itself so the worker loop can move on."""
    try:
        df = await _load_dataframe(version)
        profile = await _build_profile_response(session, version)

        column_semantic_types = {
            c.name: c.semantic_type for c in profile.columns if c.semantic_type
        }
        quality_columns = [
            ColumnQualityInput(
                name=c.name,
                semantic_type=c.semantic_type,
                raw_type=c.raw_type,
                null_count=c.null_count,
                unique_count=c.unique_count,
                stats=c.stats,
            )
            for c in profile.columns
        ]
        data_quality = analyze_data_quality(df, quality_columns)
        analysis.data_quality = {
            "score": data_quality.score,
            "issues": [
                {
                    "type": issue.type,
                    "column": issue.column,
                    "description": issue.description,
                    "severity": issue.severity,
                }
                for issue in data_quality.issues
            ],
        }

        # Idempotent: a retry that already produced insights/stories for this version reuses
        # them instead of inserting duplicates.
        insights = await InsightRepository(session).list_for_version(version.id)
        if not insights:
            insights = await analyze_dataset_version(session, version)

        stories = await StoryRepository(session).list_for_version(version.id)
        if not stories:
            stories = await generate_stories_for_version(session, version)

        await _set_stage(session, analysis, AnalysisStatus.BUILDING_AI_CONTEXT)

        context = build_analysis_context(profile, data_quality, insights)

        await _set_stage(session, analysis, AnalysisStatus.AI_ANALYZING)

        findings: AnalyticalFindings | None = None
        try:
            provider = get_ai_provider()
            findings = await analyze_dataset_findings(provider, context)
            analysis.ai_findings = findings.model_dump(mode="json")
        except AIProviderError as exc:
            # AI is advisory -- degrade gracefully to deterministic-only recommendations rather
            # than failing the whole analysis, per "deterministic services provide correctness."
            analysis.ai_findings = {"error": str(exc)[:500], "findings": []}

        await _set_stage(session, analysis, AnalysisStatus.GENERATING_RECOMMENDATIONS)

        recommendations = generate_recommendations(
            stories,
            column_semantic_types,
            str(version.id),
            ai_findings=findings.findings if findings else None,
        )

        await _set_stage(session, analysis, AnalysisStatus.VALIDATING)
        # Every candidate above has already passed validate_spec() inside
        # generate_recommendations() -- this stage exists as a visible checkpoint for the
        # frontend progress checklist, not as separate rework.

        await _set_stage(session, analysis, AnalysisStatus.RANKING)
        top, derived = split_top_and_derived(recommendations)
        shortfall_reason = recommendation_shortfall_reason(len(top))

        await _set_stage(session, analysis, AnalysisStatus.GENERATING_PREVIEWS)
        analysis.recommendations = {
            "top": [
                VisualizationRecommendationResponse(**r.__dict__).model_dump(mode="json")
                for r in top
            ],
            "derived": [
                VisualizationRecommendationResponse(**r.__dict__).model_dump(mode="json")
                for r in derived
            ],
            "shortfall_reason": shortfall_reason,
        }

        analysis.status = AnalysisStatus.READY
        analysis.completed_at = datetime.now(UTC)
        session.add(analysis)
        await session.commit()
    except Exception as exc:  # noqa: BLE001 — any stage failure lands on the Analysis row
        await _fail(session, analysis, f"{type(exc).__name__}: {exc}")
