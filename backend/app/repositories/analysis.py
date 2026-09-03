import uuid
from datetime import UTC, datetime

from sqlmodel import select

from app.models.analysis import Analysis, AnalysisStatus
from app.repositories.base import BaseRepository


class AnalysisRepository(BaseRepository[Analysis]):
    model = Analysis

    async def get_latest_for_dataset(self, dataset_id: uuid.UUID) -> Analysis | None:
        result = await self.session.exec(
            select(Analysis)
            .where(Analysis.dataset_id == dataset_id)
            .order_by(Analysis.created_at.desc())
            .limit(1)
        )
        return result.first()

    async def claim_next_queued(self) -> Analysis | None:
        """Atomically claims one queued row for this worker process. `FOR UPDATE SKIP LOCKED`
        means multiple worker replicas can poll the same table concurrently without ever
        double-claiming a row -- no separate lock/queue table needed."""
        result = await self.session.exec(
            select(Analysis)
            .where(Analysis.status == AnalysisStatus.QUEUED)
            .order_by(Analysis.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        analysis = result.first()
        if analysis is None:
            return None

        analysis.status = AnalysisStatus.PROFILING_QUALITY
        analysis.started_at = datetime.now(UTC)
        self.session.add(analysis)
        await self.session.commit()
        await self.session.refresh(analysis)
        return analysis

    async def requeue_for_retry(self, analysis: Analysis) -> Analysis:
        analysis.status = AnalysisStatus.QUEUED
        analysis.error = None
        analysis.retry_count += 1
        self.session.add(analysis)
        await self.session.commit()
        await self.session.refresh(analysis)
        return analysis
