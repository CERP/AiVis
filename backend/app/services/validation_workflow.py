"""Gemini-led dataset audit with local, integrity-gated recipe execution."""

from __future__ import annotations

import io
import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

import polars as pl
import pyarrow.parquet as pq
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.factory import get_ai_provider
from app.ai.schemas import DatasetAuditReport, DynamicTransformStep
from app.data.transforms import (
    coerce_numeric,
    dedupe_rows,
    normalize_percentage,
    parse_dates,
    standardize_case,
    trim_strings,
)
from app.insights.profiler import detect_pii, infer_semantic_type, profile_column
from app.models.analysis import Analysis, AnalysisStatus
from app.models.dataset import (
    CleaningOperation,
    DataProfile,
    DatasetColumn,
    DatasetValidationAudit,
    DatasetVersion,
)
from app.repositories.analysis import AnalysisRepository
from app.repositories.dataset import (
    DatasetColumnRepository,
    DatasetValidationAuditRepository,
    DatasetVersionRepository,
)
from app.services.storage import get_storage_service

logger = logging.getLogger("aivis.services.validation_workflow")

SUPPORTED_ACTIONS = {
    "trim_strings", "standardize_case", "coerce_numeric", "parse_dates",
    "normalize_percentage", "dedupe_rows", "replace_values", "normalize_boolean",
    "fill_missing",
}

SYSTEM_INSTRUCTION = """
You are Gemini acting as the dataset-cleaning intelligence for AiVis. Inspect the representative
rows and local statistical profile, then decide dynamically what (if anything) should be cleaned.
Return only the requested DatasetAuditReport schema.

Use dataset_status healthy, usable_with_minor_issues, requires_cleaning, or unsuitable. Missing
values alone do not make a dataset invalid. Scores are 0-100. cleaned_rows must contain the
provided __row_index and all dataset columns for every supplied sample row, reflecting the recipe.
Do not add or remove dataset columns.

Supported recipe action_type values are trim_strings; standardize_case with params.case;
coerce_numeric; parse_dates; normalize_percentage; dedupe_rows for exact full-row duplicates;
replace_values with params.mapping; normalize_boolean with params.mapping; and fill_missing with
params.method constant|mean|median|mode (plus params.value for constant).

Do not invent ambiguous values. Leave suspicious or unprovable values unchanged and include them
in remaining_issues (for example, a quiz score of 105 or -3). Every recipe step needs a concrete
reason. The application rejects unparseable conversions, unexplained row removal, non-null data
loss, unsupported actions, and cleaned sample rows inconsistent with the recipe.
"""


class WorkflowValidationError(Exception):
    def __init__(self, message: str, errors: list[str] | None = None) -> None:
        self.message = message
        self.errors = errors or [message]
        super().__init__(message)


@dataclass
class ExecutionResult:
    dataframe: pl.DataFrame
    operations: list[dict[str, Any]] = field(default_factory=list)
    validation_errors: list[str] = field(default_factory=list)
    changed_cells: int = 0
    changed_rows: int = 0
    removed_rows: int = 0


async def _load_dataframe(version: DatasetVersion) -> pl.DataFrame:
    storage = get_storage_service()
    data = storage.download_bytes(storage.bucket_processed, version.parquet_object_key)
    return pl.from_arrow(pq.read_table(io.BytesIO(data)))


def safe_rows(df: pl.DataFrame, limit: int) -> list[dict[str, Any]]:
    return json.loads(json.dumps(df.head(limit).to_dicts(), default=str))


def _representative_sample(
    df: pl.DataFrame, pii_columns: set[str], limit: int = 60
) -> list[dict[str, Any]]:
    if df.is_empty():
        return []
    indices: list[int] = list(range(min(20, df.height)))
    indices.extend(range(max(0, df.height - 10), df.height))
    indexed = df.with_row_index("__idx")
    for name in df.columns:
        indices.extend(
            int(i) for i in indexed.filter(pl.col(name).is_null())["__idx"].head(3).to_list()
        )
        if df[name].dtype == pl.Utf8:
            indices.extend(
                int(i) for i in indexed.unique(name, maintain_order=True)["__idx"].head(4).to_list()
            )
    selected = list(dict.fromkeys(i for i in indices if 0 <= i < df.height))[:limit]
    output = []
    for index in selected:
        values = df.row(index, named=True)
        output.append({
            "__row_index": index,
            **{
                name: "[REDACTED]" if name in pii_columns else value
                for name, value in values.items()
            },
        })
    return json.loads(json.dumps(output, default=str))


def _local_profile(df: pl.DataFrame, columns: list[DatasetColumn]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "row_count": df.height,
        "column_count": df.width,
        "duplicate_row_count": df.height - df.unique().height,
        "columns": [],
    }
    for column in columns:
        series = df[column.name]
        profiled = profile_column(series)
        entry: dict[str, Any] = {
            "name": column.name,
            "raw_type": str(series.dtype),
            "inferred_type": column.semantic_type,
            "is_pii": column.is_pii,
            "null_count": profiled["null_count"],
            "null_rate": round(profiled["null_count"] / max(df.height, 1), 6),
            "cardinality": profiled["unique_count"],
            "stats": profiled["stats"],
        }
        if series.dtype.is_numeric():
            non_null = series.drop_nulls()
            score_like = any(
                hint in column.name.lower() for hint in ("score", "quiz", "percent", "rate")
            )
            entry["suspicious_ranges"] = {
                "negative_count": int((non_null < 0).sum()),
                "score_like_out_of_range_count": (
                    int(((non_null < 0) | (non_null > 100)).sum()) if score_like else 0
                ),
            }
        result["columns"].append(entry)
    return json.loads(json.dumps(result, default=str))


def _synthetic_result(series: pl.Series) -> Any:
    return type("Transform", (), {
        "series": series, "valid_count": len(series), "invalid_count": 0, "details": {},
    })()


def _reject_out_of_range_constant(series: pl.Series, column: str, value: Any) -> None:
    """Blocks a sentinel imputation like "null -> 0" on a measurement column.

    A constant outside the observed spread is not a neutral placeholder: once written it is
    indistinguishable from a genuine reading, and because it sits past an edge of the
    distribution it drags the mean, distorts correlations, and reads as a true outlier to the
    IQR detector. Filling within the observed range is left alone (median/mean imputation is
    the supported path), as is a constant the column already contains -- so "null -> 0" still
    works for a count column that genuinely records zeros.
    """
    if not series.dtype.is_numeric() or isinstance(value, bool):
        return
    if not isinstance(value, (int, float)):
        return
    non_null = series.drop_nulls()
    if not len(non_null):
        return
    low, high = non_null.min(), non_null.max()
    if low <= value <= high:
        return
    raise ValueError(
        f"fill_missing would put {value} in '{column}', outside its observed range "
        f"[{low}, {high}] -- an imputed value the column never held cannot be told apart from a "
        f"real one and skews means, correlations, and outlier detection. Use median or mean, "
        f"or leave the values null"
    )


def _apply_step(
    df: pl.DataFrame, step: DynamicTransformStep
) -> tuple[pl.DataFrame, dict[str, Any]]:
    action, column, params = step.action_type, step.column_name, step.params
    if action not in SUPPORTED_ACTIONS:
        raise ValueError(f"unsupported action_type '{action}'")
    if action == "dedupe_rows":
        subset = params.get("subset")
        if subset and set(subset) != set(df.columns):
            raise ValueError("dedupe_rows may remove exact full-row duplicates only")
        result = dedupe_rows(df)
        return result.dataframe, {"removed_count": result.removed_count}
    if not column or column not in df.columns:
        raise ValueError(f"unknown column '{column}'")

    series = df[column]
    if action == "trim_strings":
        transformed = trim_strings(series)
    elif action == "standardize_case":
        transformed = standardize_case(series, case=params.get("case", "lower"))
    elif action == "coerce_numeric":
        transformed = coerce_numeric(series)
    elif action == "parse_dates":
        transformed = parse_dates(series)
    elif action == "normalize_percentage":
        transformed = normalize_percentage(series)
    elif action in {"replace_values", "normalize_boolean"}:
        mapping = params.get("mapping")
        if not isinstance(mapping, dict) or not mapping:
            raise ValueError(f"{action} requires a non-empty params.mapping")
        replaced = [
            mapping.get(str(value), value) if value is not None else None
            for value in series.to_list()
        ]
        dtype = pl.Boolean if action == "normalize_boolean" else None
        transformed = _synthetic_result(pl.Series(column, replaced, dtype=dtype, strict=False))
    else:
        method = params.get("method")
        if method == "constant":
            value = params.get("value")
        elif method == "mean" and series.dtype.is_numeric():
            value = series.mean()
        elif method == "median" and series.dtype.is_numeric():
            value = series.median()
        elif method == "mode":
            mode = series.drop_nulls().mode()
            value = mode[0] if len(mode) else None
        else:
            raise ValueError("fill_missing requires a compatible constant, mean, median, or mode")
        if value is None:
            raise ValueError("fill_missing could not determine a replacement value")
        if method == "constant":
            _reject_out_of_range_constant(series, column, value)
        transformed = _synthetic_result(series.fill_null(value))

    if transformed.invalid_count:
        raise ValueError(f"{action} would make {transformed.invalid_count} readable value(s) null")
    return df.with_columns(transformed.series.alias(column)), {
        "valid_count": transformed.valid_count,
        "invalid_count": transformed.invalid_count,
        **getattr(transformed, "details", {}),
    }


def execute_recipe(
    original: pl.DataFrame,
    recipe: list[DynamicTransformStep],
    cleaned_sample: list[dict[str, Any]] | None = None,
    pii_columns: set[str] | None = None,
) -> ExecutionResult:
    df = original.clone()
    operations: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, step in enumerate(recipe):
        try:
            df, details = _apply_step(df, step)
            operations.append({**step.model_dump(mode="json"), "details": details})
        except Exception as exc:
            errors.append(f"Step {index + 1} ({step.action_type}): {exc}")

    if df.columns != original.columns:
        errors.append("Recipe changed the dataset columns")
    if df.height > original.height:
        errors.append("Recipe added unexplained rows")
    if df.height < original.height and not any(s.action_type == "dedupe_rows" for s in recipe):
        errors.append("Recipe removed rows without an exact-duplicate step")
    for name in original.columns:
        if df[name].null_count() > original[name].null_count():
            errors.append(f"Recipe caused unexplained non-null data loss in '{name}'")

    removed = original.height - df.height
    changed_cells = 0
    changed_rows: set[int] = set()
    if removed == 0:
        for row_idx in range(original.height):
            for name in original.columns:
                before, after = original[name][row_idx], df[name][row_idx]
                if before != after and not (before is None and after is None):
                    changed_cells += 1
                    changed_rows.add(row_idx)
    if cleaned_sample and removed == 0:
        pii_columns = pii_columns or set()
        for cleaned_row in cleaned_sample:
            row_index = cleaned_row.get("__row_index")
            if not isinstance(row_index, int) or not 0 <= row_index < df.height:
                errors.append("cleaned_rows contains an invalid or missing __row_index")
                continue
            for name in original.columns:
                if name in pii_columns or name not in cleaned_row:
                    continue
                expected = json.loads(json.dumps(df[name][row_index], default=str))
                if cleaned_row[name] != expected:
                    errors.append(
                        "cleaned_rows is inconsistent with the recipe at "
                        f"row {row_index}, column '{name}'"
                    )
                    break
    return ExecutionResult(
        dataframe=df,
        operations=operations,
        validation_errors=list(dict.fromkeys(errors)),
        changed_cells=changed_cells,
        changed_rows=len(changed_rows) + removed,
        removed_rows=removed,
    )


async def get_or_create_audit(
    session: AsyncSession, dataset_id: uuid.UUID, preview_limit: int = 100,
    refresh: bool = False,
) -> DatasetValidationAudit:
    """An audit is cached indefinitely against its source version, since re-running it costs a
    Gemini call. `refresh` re-audits anyway -- needed when a stored audit has gone stale (the
    recipe engine changed under it) or when Gemini simply had a bad run. The new audit supersedes
    the old one by recency rather than deleting it, so the earlier verdict stays auditable.
    """
    versions = await DatasetVersionRepository(session).list_for_dataset(dataset_id)
    source = next((version for version in versions if version.is_raw), None)
    if source is None:
        raise WorkflowValidationError("Original dataset version was not found")
    repo = DatasetValidationAuditRepository(session)
    cached = await repo.get_latest_for_source(dataset_id, source.id)
    if cached is not None and not refresh:
        return cached

    df = await _load_dataframe(source)
    columns = await DatasetColumnRepository(session).list_for_version(source.id)
    profile = _local_profile(df, columns)
    pii_columns = {column.name for column in columns if column.is_pii}
    sample = _representative_sample(df, pii_columns)
    prompt = json.dumps({"profile": profile, "representative_rows": sample}, default=str)
    report = await get_ai_provider().generate_structured(
        system_instruction=SYSTEM_INSTRUCTION,
        prompt=f"Audit this dataset. Dataset context:\n{prompt}",
        response_schema=DatasetAuditReport,
    )
    executed = execute_recipe(df, report.cleaning_recipe, report.cleaned_rows, pii_columns)
    preview = {
        "columns": df.columns,
        "before_rows": safe_rows(df, min(max(preview_limit, 1), 200)),
        "after_rows": safe_rows(executed.dataframe, min(max(preview_limit, 1), 200)),
        "changed_cells": executed.changed_cells,
        "changed_rows": executed.changed_rows,
        "removed_rows": executed.removed_rows,
    }
    return await repo.create(DatasetValidationAudit(
        dataset_id=dataset_id,
        source_version_id=source.id,
        status="validation_failed" if executed.validation_errors else "ready",
        report=report.model_dump(mode="json"),
        profile=profile,
        preview=preview,
        validation_errors=executed.validation_errors,
    ))


async def _persist_cleaned_version(
    session: AsyncSession, audit: DatasetValidationAudit, source: DatasetVersion,
    result: ExecutionResult,
) -> DatasetVersion:
    versions = await DatasetVersionRepository(session).list_for_dataset(source.dataset_id)
    next_number = max(version.version_number for version in versions) + 1
    buffer = io.BytesIO()
    result.dataframe.write_parquet(buffer)
    storage = get_storage_service()
    key = storage.build_object_key(source.dataset_id, f"{source.dataset_id}-v{next_number}.parquet")
    storage.upload_bytes(
        storage.bucket_processed, key, buffer.getvalue(), "application/octet-stream"
    )
    version = DatasetVersion(
        dataset_id=source.dataset_id, version_number=next_number, parquet_object_key=key,
        row_count=result.dataframe.height, column_count=result.dataframe.width, is_raw=False,
        parent_version_id=source.id,
    )
    pending: list[Any] = []
    for ordinal, name in enumerate(result.dataframe.columns):
        series = result.dataframe[name]
        column = DatasetColumn(
            dataset_version_id=version.id, name=name, ordinal=ordinal, raw_type=str(series.dtype),
            semantic_type=infer_semantic_type(name, series), is_pii=detect_pii(name, series),
        )
        profile = profile_column(series)
        pending.extend([column, DataProfile(
            dataset_column_id=column.id, null_count=profile["null_count"],
            unique_count=profile["unique_count"], stats=profile["stats"],
        )])
    pending.append(CleaningOperation(
        dataset_version_id=version.id, operation_type="gemini_dynamic_recipe",
        params={"audit_id": str(audit.id), "steps": result.operations},
        valid_count=result.dataframe.height, invalid_count=result.removed_rows, ai_suggested=True,
    ))
    try:
        # Flush the parent first so SQLAlchemy cannot schedule the audit FK update ahead of
        # the DatasetVersion insert (there is intentionally no ORM relationship between them).
        session.add(version)
        await session.flush()
        audit.cleaned_version_id = version.id
        audit.status = "applied"
        pending.append(audit)
        session.add_all(pending)
        await session.commit()
        await session.refresh(version)
    except Exception:
        await session.rollback()
        storage.delete_object(storage.bucket_processed, key)
        raise
    return version


async def select_workflow_version(
    session: AsyncSession, dataset_id: uuid.UUID, audit_id: uuid.UUID, selection: str,
) -> tuple[DatasetVersion, bool]:
    audit = await DatasetValidationAuditRepository(session).get(audit_id)
    if audit is None or audit.dataset_id != dataset_id:
        raise WorkflowValidationError("Validation audit was not found")
    source = await DatasetVersionRepository(session).get(audit.source_version_id)
    if source is None or not source.is_raw:
        raise WorkflowValidationError("Audit source version is not the immutable original")
    created = False
    if selection == "original":
        selected = source
    elif selection == "cleaned":
        if audit.validation_errors:
            raise WorkflowValidationError(
                "Gemini cleaning candidate failed integrity validation", audit.validation_errors
            )
        if audit.cleaned_version_id:
            existing = await DatasetVersionRepository(session).get(audit.cleaned_version_id)
            if existing is None:
                raise WorkflowValidationError("Committed cleaned version was not found")
            selected = existing
        else:
            report = DatasetAuditReport.model_validate(audit.report)
            original = await _load_dataframe(source)
            result = execute_recipe(original, report.cleaning_recipe, report.cleaned_rows)
            if result.validation_errors:
                raise WorkflowValidationError(
                    "Full-dataset integrity validation failed", result.validation_errors
                )
            selected = await _persist_cleaned_version(session, audit, source, result)
            created = True
    else:
        raise WorkflowValidationError("selection must be 'original' or 'cleaned'")
    latest = await AnalysisRepository(session).get_latest_for_dataset(dataset_id)
    if latest is None or latest.dataset_version_id != selected.id:
        await AnalysisRepository(session).create(Analysis(
            dataset_id=dataset_id, dataset_version_id=selected.id, status=AnalysisStatus.QUEUED,
        ))
    return selected, created
