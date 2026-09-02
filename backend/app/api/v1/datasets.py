import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_organization_id
from app.core.config import get_settings
from app.core.db import get_session
from app.data.ingestion import IngestionError as ParseError
from app.data.upload_validation import UploadValidationError, validate_upload
from app.models.dataset import Dataset, DatasetStatus
from app.repositories.dataset import (
    DataProfileRepository,
    DatasetColumnRepository,
    DatasetRepository,
    DatasetVersionRepository,
)
from app.repositories.insight import InsightRepository, StoryRepository
from app.repositories.project import ProjectRepository
from app.schemas.cleaning import CleaningRequest, CleaningResponse
from app.schemas.dataset import DatasetResponse
from app.schemas.insight import InsightResponse
from app.schemas.profile import ColumnProfileResponse, DatasetProfileResponse
from app.schemas.story import StoryResponse
from app.services.cleaning import CleaningError, apply_cleaning_operation
from app.services.ingestion import ingest_dataset
from app.services.insight_analysis import analyze_dataset_version
from app.services.storage import get_storage_service
from app.services.story_analysis import generate_stories_for_version

router = APIRouter(prefix="/datasets", tags=["datasets"])


async def _require_project(
    project_id: uuid.UUID, organization_id: uuid.UUID, session: AsyncSession
) -> None:
    project = await ProjectRepository(session).get(project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.post("", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    project_id: uuid.UUID,
    file: UploadFile,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> Dataset:
    await _require_project(project_id, organization_id, session)

    if file.filename is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Missing filename"
        )

    settings = get_settings()
    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    data = await file.read()

    try:
        extension, sniffed_mime = validate_upload(
            filename=file.filename, data=data, max_size_bytes=max_size_bytes
        )
    except UploadValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=exc.message
        ) from exc

    dataset_repo = DatasetRepository(session)
    dataset = Dataset(
        project_id=project_id,
        name=file.filename,
        original_filename=file.filename,
        mime_type=sniffed_mime,
        size_bytes=len(data),
        status=DatasetStatus.UPLOADING,
        raw_object_key="",
    )

    storage = get_storage_service()
    object_key = storage.build_object_key(uuid.uuid4(), file.filename)
    storage.ensure_buckets()
    storage.upload_bytes(storage.bucket_raw, object_key, data, sniffed_mime)
    dataset.raw_object_key = object_key
    dataset = await dataset_repo.create(dataset)

    dataset.status = DatasetStatus.INGESTING
    session.add(dataset)
    await session.commit()

    try:
        await ingest_dataset(session, dataset, extension, data)
    except ParseError as exc:
        dataset.status = DatasetStatus.FAILED
        dataset.error_message = exc.message
        session.add(dataset)
        await session.commit()

    await session.refresh(dataset)
    return dataset


@router.get("", response_model=list[DatasetResponse])
async def list_datasets(
    project_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[Dataset]:
    await _require_project(project_id, organization_id, session)
    return await DatasetRepository(session).list_for_project(project_id)


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> Dataset:
    dataset = await DatasetRepository(session).get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)
    return dataset


@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
async def get_dataset_profile(
    dataset_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> DatasetProfileResponse:
    dataset = await DatasetRepository(session).get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)

    if dataset.status != DatasetStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset is not ready (status={dataset.status})",
        )

    version = await DatasetVersionRepository(session).get_latest(dataset_id)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No dataset version")

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


@router.post(
    "/{dataset_id}/clean", response_model=CleaningResponse, status_code=status.HTTP_201_CREATED
)
async def clean_dataset(
    dataset_id: uuid.UUID,
    payload: CleaningRequest,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> CleaningResponse:
    dataset = await DatasetRepository(session).get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)

    if dataset.status != DatasetStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset is not ready (status={dataset.status})",
        )

    source_version = await DatasetVersionRepository(session).get_latest(dataset_id)
    if source_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No dataset version")

    try:
        new_version, operation = await apply_cleaning_operation(
            session,
            source_version=source_version,
            operation_type=payload.operation_type,
            column_name=payload.column_name,
            params=payload.params,
        )
    except CleaningError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=exc.message
        ) from exc

    return CleaningResponse(
        new_version_id=new_version.id,
        version_number=new_version.version_number,
        row_count=new_version.row_count,
        column_count=new_version.column_count,
        valid_count=operation.valid_count,
        invalid_count=operation.invalid_count,
    )


@router.post(
    "/{dataset_id}/insights/analyze",
    response_model=list[InsightResponse],
    status_code=status.HTTP_201_CREATED,
)
async def analyze_insights(
    dataset_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[InsightResponse]:
    dataset = await DatasetRepository(session).get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)

    if dataset.status != DatasetStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset is not ready (status={dataset.status})",
        )

    version = await DatasetVersionRepository(session).get_latest(dataset_id)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No dataset version")

    insights = await analyze_dataset_version(session, version)
    return insights


@router.get("/{dataset_id}/insights", response_model=list[InsightResponse])
async def list_insights(
    dataset_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[InsightResponse]:
    dataset = await DatasetRepository(session).get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)

    version = await DatasetVersionRepository(session).get_latest(dataset_id)
    if version is None:
        return []

    return await InsightRepository(session).list_for_version(version.id)


@router.post(
    "/{dataset_id}/stories/analyze",
    response_model=list[StoryResponse],
    status_code=status.HTTP_201_CREATED,
)
async def analyze_stories(
    dataset_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[StoryResponse]:
    dataset = await DatasetRepository(session).get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)

    if dataset.status != DatasetStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset is not ready (status={dataset.status})",
        )

    version = await DatasetVersionRepository(session).get_latest(dataset_id)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No dataset version")

    existing_insights = await InsightRepository(session).list_for_version(version.id)
    if not existing_insights:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No insights found; run /insights/analyze first",
        )

    stories = await generate_stories_for_version(session, version)
    return stories


@router.get("/{dataset_id}/stories", response_model=list[StoryResponse])
async def list_stories(
    dataset_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[StoryResponse]:
    dataset = await DatasetRepository(session).get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)

    version = await DatasetVersionRepository(session).get_latest(dataset_id)
    if version is None:
        return []

    return await StoryRepository(session).list_for_version(version.id)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    dataset_repo = DatasetRepository(session)
    dataset = await dataset_repo.get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await _require_project(dataset.project_id, organization_id, session)

    storage = get_storage_service()
    if dataset.raw_object_key:
        storage.delete_object(storage.bucket_raw, dataset.raw_object_key)
    await dataset_repo.delete(dataset)
