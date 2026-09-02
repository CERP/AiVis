from __future__ import annotations

import io

import polars as pl
import pyarrow.parquet as pq
from sqlmodel.ext.asyncio.session import AsyncSession

from app.insights.engine import generate_insights
from app.models.dataset import DatasetVersion
from app.models.insight import Insight
from app.repositories.dataset import DatasetColumnRepository
from app.repositories.insight import InsightRepository
from app.services.storage import get_storage_service


async def analyze_dataset_version(
    session: AsyncSession, version: DatasetVersion
) -> list[Insight]:
    storage = get_storage_service()
    parquet_bytes = storage.download_bytes(storage.bucket_processed, version.parquet_object_key)
    df = pl.from_arrow(pq.read_table(io.BytesIO(parquet_bytes)))

    columns = await DatasetColumnRepository(session).list_for_version(version.id)
    semantic_types = {c.name: c.semantic_type for c in columns if c.semantic_type}

    candidates = generate_insights(df, semantic_types)

    insight_repo = InsightRepository(session)
    saved: list[Insight] = []
    for candidate in candidates:
        insight = await insight_repo.create(
            Insight(
                dataset_version_id=version.id,
                type=candidate.type,
                title=candidate.title,
                description=candidate.description,
                fields=candidate.fields,
                calculation=candidate.calculation,
                confidence=candidate.confidence,
            )
        )
        saved.append(insight)

    return saved
