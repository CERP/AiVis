"""Orchestrates raw bytes -> Polars parse -> Parquet -> object storage -> DatasetVersion/Columns.

Kept synchronous and called inline from the upload endpoint for now (no worker queue yet —
that's the Phase 27 performance concern once datasets are large enough to warrant it).
"""

from __future__ import annotations

from sqlmodel.ext.asyncio.session import AsyncSession

from app.data.ingestion import (
    IngestionError,
    dataframe_to_parquet_bytes,
    deduplicate_column_names,
    normalize_column_name,
    parse_to_dataframe,
)
from app.insights.profiler import detect_pii, infer_semantic_type, profile_column
from app.models.dataset import DataProfile, Dataset, DatasetColumn, DatasetStatus, DatasetVersion
from app.repositories.dataset import (
    DataProfileRepository,
    DatasetColumnRepository,
    DatasetVersionRepository,
)
from app.services.storage import get_storage_service


async def ingest_dataset(
    session: AsyncSession, dataset: Dataset, extension: str, raw_bytes: bytes
) -> DatasetVersion:
    """Mutates `dataset.status` and persists it. Raises IngestionError on failure (caller
    is responsible for setting status=FAILED + error_message and committing)."""
    df = parse_to_dataframe(extension=extension, data=raw_bytes)

    normalized_names = deduplicate_column_names([normalize_column_name(c) for c in df.columns])
    df.columns = normalized_names

    parquet_bytes = dataframe_to_parquet_bytes(df)

    storage = get_storage_service()
    parquet_key = storage.build_object_key(dataset.id, f"{dataset.id}.parquet")
    storage.upload_bytes(
        storage.bucket_processed, parquet_key, parquet_bytes, "application/octet-stream"
    )

    version = await DatasetVersionRepository(session).create(
        DatasetVersion(
            dataset_id=dataset.id,
            version_number=0,
            parquet_object_key=parquet_key,
            row_count=df.height,
            column_count=df.width,
            is_raw=True,
        )
    )

    dataset.status = DatasetStatus.PROFILING
    session.add(dataset)
    await session.commit()

    column_repo = DatasetColumnRepository(session)
    profile_repo = DataProfileRepository(session)
    for ordinal, name in enumerate(df.columns):
        series = df[name]
        semantic_type = infer_semantic_type(name, series)
        is_pii = detect_pii(name, series)

        column = await column_repo.create(
            DatasetColumn(
                dataset_version_id=version.id,
                name=name,
                ordinal=ordinal,
                raw_type=str(series.dtype),
                semantic_type=semantic_type,
                is_pii=is_pii,
            )
        )

        profile = profile_column(series)
        await profile_repo.create(
            DataProfile(
                dataset_column_id=column.id,
                null_count=profile["null_count"],
                unique_count=profile["unique_count"],
                stats=profile["stats"],
            )
        )

    dataset.status = DatasetStatus.READY
    session.add(dataset)
    await session.commit()
    return version


__all__ = ["ingest_dataset", "IngestionError"]
