"""Background worker: polls the `analyses` table for queued rows and runs the pipeline.

No message broker -- `AnalysisRepository.claim_next_queued()` uses `SELECT ... FOR UPDATE SKIP
LOCKED`, so multiple worker replicas can run this same loop against the same table safely with
zero additional infra. This is intentionally the simplest thing that gives durable (survives
API-process restarts), automatic background processing given the dataset sizes this app handles.
"""

from __future__ import annotations

import asyncio
import logging
import time

from app.core.db import async_session_factory
from app.repositories.analysis import AnalysisRepository
from app.repositories.dataset import DatasetVersionRepository
from app.services.analysis_orchestrator import run_analysis

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("aivis.worker")

_POLL_INTERVAL_SECONDS = 2.0


async def _run_one_cycle() -> bool:
    """Claims and runs at most one queued analysis. Returns True if it found work."""
    async with async_session_factory() as session:
        analysis = await AnalysisRepository(session).claim_next_queued()
        if analysis is None:
            return False

        version = await DatasetVersionRepository(session).get(analysis.dataset_version_id)
        if version is None:
            # Unreachable in practice -- dataset_version_id is a non-nullable FK -- but guard
            # against it rather than crashing the worker loop.
            logger.error(
                "analysis=%s dataset=%s missing dataset_version, cannot run",
                analysis.id,
                analysis.dataset_id,
            )
            return True

        started = time.monotonic()
        logger.info("analysis=%s dataset=%s stage=start", analysis.id, analysis.dataset_id)
        await run_analysis(session, analysis, version)
        duration = time.monotonic() - started
        logger.info(
            "analysis=%s dataset=%s stage=%s duration_s=%.2f",
            analysis.id,
            analysis.dataset_id,
            analysis.status,
            duration,
        )
        return True


async def run_forever() -> None:
    logger.info("worker started, polling every %.1fs", _POLL_INTERVAL_SECONDS)
    while True:
        try:
            found_work = await _run_one_cycle()
        except Exception:  # noqa: BLE001 — never let a single bad cycle kill the worker loop
            logger.exception("unhandled error in worker cycle")
            found_work = False

        if not found_work:
            await asyncio.sleep(_POLL_INTERVAL_SECONDS)


def main() -> None:
    asyncio.run(run_forever())


if __name__ == "__main__":
    main()
