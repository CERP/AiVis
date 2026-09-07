import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_organization_id
from app.core.db import get_session
from app.models.project import Project
from app.repositories.dataset import DatasetRepository
from app.repositories.project import ProjectRepository
from app.schemas.project import ProjectCreateRequest, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


async def _to_response(project: Project, session: AsyncSession) -> ProjectResponse:
    dataset_count = len(await DatasetRepository(session).list_for_project(project.id))
    return ProjectResponse(
        id=project.id,
        organization_id=project.organization_id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        updated_at=project.updated_at,
        dataset_count=dataset_count,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateRequest,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> ProjectResponse:
    project = await ProjectRepository(session).create(
        Project(
            organization_id=organization_id, name=payload.name, description=payload.description
        )
    )
    return await _to_response(project, session)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> list[ProjectResponse]:
    projects = await ProjectRepository(session).list_for_organization(organization_id)
    return [await _to_response(project, session) for project in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> ProjectResponse:
    project = await ProjectRepository(session).get(project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await _to_response(project, session)
