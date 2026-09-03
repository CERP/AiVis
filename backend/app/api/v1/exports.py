import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_organization_id
from app.core.config import get_settings
from app.core.db import get_session
from app.models.export import Export, ExportFormat, ExportStatus
from app.repositories.export import ExportRepository
from app.repositories.project import ProjectRepository
from app.repositories.visualization import VisualizationRepository, VisualizationVersionRepository
from app.schemas.export import ExportResponse
from app.services.storage import get_storage_service

router = APIRouter(prefix="/exports", tags=["exports"])

_CONTENT_TYPES = {
    ExportFormat.SVG: "image/svg+xml",
    ExportFormat.PNG: "image/png",
    ExportFormat.JSON: "application/json",
}


async def _to_response(export: Export, session: AsyncSession) -> ExportResponse:
    download_url = None
    if export.object_key:
        storage = get_storage_service()
        download_url = storage.presigned_get_url(storage.bucket_exports, export.object_key)
    return ExportResponse(
        id=export.id,
        visualization_version_id=export.visualization_version_id,
        format=export.format,
        status=export.status,
        download_url=download_url,
        error_message=export.error_message,
        created_at=export.created_at,
    )


async def _require_owned_version(
    visualization_version_id: uuid.UUID, organization_id: uuid.UUID, session: AsyncSession
):
    version = await VisualizationVersionRepository(session).get(visualization_version_id)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    visualization = await VisualizationRepository(session).get(version.visualization_id)
    if visualization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    project = await ProjectRepository(session).get(visualization.project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version


@router.post("", response_model=ExportResponse, status_code=status.HTTP_201_CREATED)
async def create_export(
    visualization_version_id: uuid.UUID,
    format: ExportFormat,
    file: UploadFile,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> ExportResponse:
    """Persists an already-rendered export (SVG/PNG/JSON spec) produced client-side by the
    studio -- this endpoint never renders anything itself, it just stores bytes the browser
    already generated so they're shareable/reopenable via a signed URL."""
    if format == ExportFormat.PDF:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="PDF export not implemented"
        )

    await _require_owned_version(visualization_version_id, organization_id, session)

    settings = get_settings()
    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Empty file")
    if len(data) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Export exceeds size limit"
        )

    storage = get_storage_service()
    object_key = storage.build_object_key(
        visualization_version_id, f"export.{format.value}"
    )
    storage.ensure_buckets()
    storage.upload_bytes(storage.bucket_exports, object_key, data, _CONTENT_TYPES[format])

    export_repo = ExportRepository(session)
    export = await export_repo.create(
        Export(
            visualization_version_id=visualization_version_id,
            format=format,
            status=ExportStatus.READY,
            object_key=object_key,
        )
    )
    return await _to_response(export, session)


@router.get("/{export_id}", response_model=ExportResponse)
async def get_export(
    export_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> ExportResponse:
    export = await ExportRepository(session).get(export_id)
    if export is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found")
    await _require_owned_version(export.visualization_version_id, organization_id, session)
    return await _to_response(export, session)
