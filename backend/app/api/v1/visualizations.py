import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.base import AIProviderError
from app.ai.factory import get_ai_provider
from app.api.deps import get_current_organization_id
from app.core.db import get_session
from app.models.dataset import Dataset, DatasetVersion
from app.models.visualization import Visualization, VisualizationVersion
from app.repositories.dataset import DatasetVersionRepository
from app.repositories.project import ProjectRepository
from app.repositories.visualization import VisualizationRepository, VisualizationVersionRepository
from app.schemas.visualization import (
    ApplyCommandRequest,
    CreateVisualizationRequest,
    NLEditRequest,
    SetFavoriteRequest,
    VisualizationResponse,
    VisualizationSummaryResponse,
    VisualizationVersionResponse,
)
from app.services.visualization import (
    NoPreviousVersionError,
    VisualizationValidationError,
    apply_command_to_visualization,
    apply_nl_edit_to_visualization,
    create_visualization,
    revert_to_previous_version,
)
from app.visualization.commands import CommandError

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
        is_favorite=visualization.is_favorite,
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


@router.get("", response_model=list[VisualizationSummaryResponse])
async def list_visualizations_route(
    project_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[VisualizationSummaryResponse]:
    """Project-hub listing -- three batched queries regardless of visualization count, never one
    query per row, since this powers a page that may list many visualizations at once."""
    project = await ProjectRepository(session).get(project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    visualizations = await VisualizationRepository(session).list_for_project(project_id)
    if not visualizations:
        return []

    dataset_version_ids = {v.dataset_version_id for v in visualizations}
    version_result = await session.exec(
        select(DatasetVersion).where(DatasetVersion.id.in_(dataset_version_ids))
    )
    dataset_id_by_version_id = {v.id: v.dataset_id for v in version_result.all()}

    dataset_ids = set(dataset_id_by_version_id.values())
    dataset_result = await session.exec(select(Dataset).where(Dataset.id.in_(dataset_ids)))
    dataset_name_by_id = {d.id: d.name for d in dataset_result.all()}

    current_version_ids = {v.current_version_id for v in visualizations if v.current_version_id}
    chart_type_by_version_id: dict[uuid.UUID, str | None] = {}
    if current_version_ids:
        chart_version_result = await session.exec(
            select(VisualizationVersion).where(VisualizationVersion.id.in_(current_version_ids))
        )
        chart_type_by_version_id = {
            v.id: v.spec.get("chart_type") for v in chart_version_result.all()
        }

    summaries: list[VisualizationSummaryResponse] = []
    for visualization in visualizations:
        dataset_id = dataset_id_by_version_id.get(visualization.dataset_version_id)
        chart_type = (
            chart_type_by_version_id.get(visualization.current_version_id)
            if visualization.current_version_id
            else None
        )
        summaries.append(
            VisualizationSummaryResponse(
                id=visualization.id,
                title=visualization.title,
                chart_type=chart_type,
                dataset_id=dataset_id,
                dataset_name=dataset_name_by_id.get(dataset_id, "Unknown dataset"),
                updated_at=visualization.updated_at,
            )
        )
    return summaries


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
    except CommandError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=exc.message
        ) from exc

    return new_version


@router.patch("/{visualization_id}/favorite", response_model=VisualizationResponse)
async def set_favorite_route(
    visualization_id: uuid.UUID,
    payload: SetFavoriteRequest,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> VisualizationResponse:
    visualization = await _get_owned_visualization(visualization_id, organization_id, session)
    visualization.is_favorite = payload.is_favorite
    session.add(visualization)
    await session.commit()
    await session.refresh(visualization)
    return await _to_response(visualization, session)


@router.post("/{visualization_id}/nl-edit", response_model=VisualizationVersionResponse)
async def nl_edit_route(
    visualization_id: uuid.UUID,
    payload: NLEditRequest,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> VisualizationVersionResponse:
    """Natural-language studio edit: Gemini translates `payload.query` into one structured
    command against the visualization's current spec, applied through the same deterministic,
    validated path a manual studio control uses -- see app/services/nl_studio_edit.py."""
    visualization = await _get_owned_visualization(visualization_id, organization_id, session)
    try:
        provider = get_ai_provider()
        new_version = await apply_nl_edit_to_visualization(
            session, visualization=visualization, provider=provider, query=payload.query
        )
    except AIProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI edit failed: {exc}"
        ) from exc
    except (VisualizationValidationError, CommandError) as exc:
        detail = "; ".join(exc.result.errors) if isinstance(exc, VisualizationValidationError) else exc.message
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail) from exc

    return new_version


@router.post("/{visualization_id}/undo", response_model=VisualizationVersionResponse)
async def undo_route(
    visualization_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> VisualizationVersionResponse:
    visualization = await _get_owned_visualization(visualization_id, organization_id, session)
    try:
        return await revert_to_previous_version(session, visualization=visualization)
    except NoPreviousVersionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/{visualization_id}/versions", response_model=list[VisualizationVersionResponse])
async def list_versions_route(
    visualization_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[VisualizationVersionResponse]:
    await _get_owned_visualization(visualization_id, organization_id, session)
    return await VisualizationVersionRepository(session).list_for_visualization(visualization_id)
