import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_organization_id
from app.core.config import get_settings
from app.core.db import get_session
from app.data.ingestion import IngestionError as ParseError
from app.data.upload_validation import UploadValidationError, validate_upload
from app.models.dataset import Dataset, DatasetStatus
from app.repositories.dataset import DatasetRepository
from app.repositories.project import ProjectRepository
from app.schemas.dataset import DatasetResponse
from app.services.ingestion import ingest_dataset
from app.services.storage import get_storage_service

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
