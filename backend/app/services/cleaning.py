"""Applies a single deterministic transform to a dataset version, producing a new immutable
version. The original version is never mutated — cleaning always appends to the version chain
(see DatasetVersion.parent_version_id)."""

from __future__ import annotations

import io

import polars as pl
import pyarrow.parquet as pq
from sqlmodel.ext.asyncio.session import AsyncSession

from app.data.transforms import (
    coerce_numeric,
    dedupe_rows,
    normalize_percentage,
    parse_dates,
    standardize_case,
    trim_strings,
)
from app.insights.profiler import detect_pii, infer_semantic_type, profile_column
from app.models.dataset import (
    CleaningOperation,
    DataProfile,
    DatasetColumn,
    DatasetVersion,
)
from app.repositories.dataset import (
    CleaningOperationRepository,
    DataProfileRepository,
    DatasetColumnRepository,
    DatasetVersionRepository,
)
from app.services.storage import get_storage_service

_COLUMN_OPERATIONS = {
    "trim_strings": trim_strings,
    "coerce_numeric": coerce_numeric,
    "parse_dates": parse_dates,
    "normalize_percentage": normalize_percentage,
    "standardize_case": standardize_case,
}


class CleaningError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


async def _load_dataframe(version: DatasetVersion) -> pl.DataFrame:
    storage = get_storage_service()
    parquet_bytes = storage.download_bytes(storage.bucket_processed, version.parquet_object_key)
    return pl.from_arrow(pq.read_table(io.BytesIO(parquet_bytes)))


async def apply_cleaning_operation(
    session: AsyncSession,
    *,
    source_version: DatasetVersion,
    operation_type: str,
    column_name: str | None,
    params: dict,
) -> tuple[DatasetVersion, CleaningOperation]:
    df = await _load_dataframe(source_version)

    valid_count = df.height
    invalid_count = 0

    if operation_type == "dedupe_rows":
        subset = params.get("subset")
        result = dedupe_rows(df, subset=subset)
        df = result.dataframe
        invalid_count = result.removed_count
        valid_count = df.height
    elif operation_type in _COLUMN_OPERATIONS:
        if column_name is None or column_name not in df.columns:
            raise CleaningError(f"Unknown column: {column_name}")
        fn = _COLUMN_OPERATIONS[operation_type]
        kwargs = {}
        if operation_type == "standardize_case" and "case" in params:
            kwargs["case"] = params["case"]
        result = fn(df[column_name], **kwargs)
        df = df.with_columns(result.series.alias(column_name))
        valid_count = result.valid_count
        invalid_count = result.invalid_count
    else:
        raise CleaningError(f"Unknown operation type: {operation_type}")

    buffer = io.BytesIO()
    df.write_parquet(buffer)
    parquet_bytes = buffer.getvalue()

    next_version_number = source_version.version_number + 1
    filename = f"{source_version.dataset_id}-v{next_version_number}.parquet"
    storage = get_storage_service()
    parquet_key = storage.build_object_key(source_version.dataset_id, filename)
    storage.upload_bytes(
        storage.bucket_processed, parquet_key, parquet_bytes, "application/octet-stream"
    )

    version_repo = DatasetVersionRepository(session)
    new_version = await version_repo.create(
        DatasetVersion(
            dataset_id=source_version.dataset_id,
            version_number=source_version.version_number + 1,
            parquet_object_key=parquet_key,
            row_count=df.height,
            column_count=df.width,
            is_raw=False,
            parent_version_id=source_version.id,
        )
    )

    column_repo = DatasetColumnRepository(session)
    profile_repo = DataProfileRepository(session)
    for ordinal, name in enumerate(df.columns):
        series = df[name]
        column = await column_repo.create(
            DatasetColumn(
                dataset_version_id=new_version.id,
                name=name,
                ordinal=ordinal,
                raw_type=str(series.dtype),
                semantic_type=infer_semantic_type(name, series),
                is_pii=detect_pii(name, series),
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

    operation = await CleaningOperationRepository(session).create(
        CleaningOperation(
            dataset_version_id=new_version.id,
            operation_type=operation_type,
            column_name=column_name,
            params=params,
            valid_count=valid_count,
            invalid_count=invalid_count,
            ai_suggested=False,
        )
    )

    return new_version, operation
