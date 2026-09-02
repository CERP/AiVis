import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_organization_id
from app.core.db import get_session
from app.models.visualization import Visualization
from app.repositories.dataset import DatasetVersionRepository
from app.repositories.project import ProjectRepository
from app.repositories.visualization import VisualizationRepository, VisualizationVersionRepository
from app.schemas.visualization import (
    ApplyCommandRequest,
    CreateVisualizationRequest,
    VisualizationResponse,
    VisualizationVersionResponse,
)
from app.services.visualization import (
    VisualizationValidationError,
    apply_command_to_visualization,
    create_visualization,
)

router = APIRouter(prefix="/visualizations", tags=["visualizations"])


async def _get_owned_visualization(
    visualization_id: uuid.UUID, organization_id: uuid.UUID, session: AsyncSession
) -> Visualization:
    visualization = await VisualizationRepository(session).get(visualization_id)
    if visualization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")
    project = await ProjectRepository(session).get(visualization.project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")
    return visualization


async def _to_response(
    visualization: Visualization, session: AsyncSession
) -> VisualizationResponse:
    version = await DatasetVersionRepository(session).get(visualization.dataset_version_id)
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Visualization references a missing dataset version",
        )
    return VisualizationResponse(
        id=visualization.id,
        project_id=visualization.project_id,
        dataset_id=version.dataset_id,
        dataset_version_id=visualization.dataset_version_id,
        story_id=visualization.story_id,
        title=visualization.title,
        current_version_id=visualization.current_version_id,
        created_at=visualization.created_at,
    )


@router.post("", response_model=VisualizationResponse, status_code=status.HTTP_201_CREATED)
async def create_visualization_route(
    payload: CreateVisualizationRequest,
    project_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> VisualizationResponse:
    project = await ProjectRepository(session).get(project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    try:
        visualization, _version = await create_visualization(
            session,
            project_id=project_id,
            title=payload.title,
            story_id=payload.story_id,
            spec=payload.spec,
        )
    except VisualizationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="; ".join(exc.result.errors)
        ) from exc

    return await _to_response(visualization, session)


@router.get("/{visualization_id}", response_model=VisualizationResponse)
async def get_visualization_route(
    visualization_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> VisualizationResponse:
    visualization = await _get_owned_visualization(visualization_id, organization_id, session)
    return await _to_response(visualization, session)


@router.patch("/{visualization_id}", response_model=VisualizationVersionResponse)
async def apply_command_route(
    visualization_id: uuid.UUID,
    payload: ApplyCommandRequest,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> VisualizationVersionResponse:
    visualization = await _get_owned_visualization(visualization_id, organization_id, session)
    try:
        new_version = await apply_command_to_visualization(
            session, visualization=visualization, command=payload.command
        )
    except VisualizationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="; ".join(exc.result.errors)
        ) from exc

    return new_version


@router.get("/{visualization_id}/versions", response_model=list[VisualizationVersionResponse])
async def list_versions_route(
    visualization_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[VisualizationVersionResponse]:
    await _get_owned_visualization(visualization_id, organization_id, session)
    return await VisualizationVersionRepository(session).list_for_visualization(visualization_id)
