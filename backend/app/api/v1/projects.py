import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_organization_id
from app.core.db import get_session
from app.models.project import Project
from app.repositories.dataset import DatasetRepository
from app.repositories.project import ProjectRepository
from app.schemas.project import ProjectCreateRequest, ProjectResponse, ProjectUpdateRequest

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


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdateRequest,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> ProjectResponse:
    project_repo = ProjectRepository(session)
    project = await project_repo.get(project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project.name = payload.name
    if payload.description is not None:
        project.description = payload.description

    session.add(project)
    await session.commit()
    await session.refresh(project)

    return await _to_response(project, session)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    project_repo = ProjectRepository(session)
    project = await project_repo.get(project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    from sqlmodel import delete, select

    from app.models.analysis import Analysis
    from app.models.dataset import Dataset, DatasetVersion
    from app.models.insight import Insight, Story
    from app.models.visualization import Visualization, VisualizationVersion
    from app.services.storage import get_storage_service

    datasets_result = await session.exec(
        select(Dataset).where(Dataset.project_id == project_id)
    )
    datasets = list(datasets_result.all())

    storage = get_storage_service()

    for dataset in datasets:
        version_ids_result = await session.exec(
            select(DatasetVersion.id).where(DatasetVersion.dataset_id == dataset.id)
        )
        version_ids = list(version_ids_result.all())

        if version_ids:
            vis_result = await session.exec(
                select(Visualization).where(Visualization.dataset_version_id.in_(version_ids))
            )
            visualizations = list(vis_result.all())
            vis_ids = [vis.id for vis in visualizations]

            if vis_ids:
                await session.exec(
                    delete(VisualizationVersion).where(VisualizationVersion.visualization_id.in_(vis_ids))
                )
                for vis in visualizations:
                    await session.delete(vis)

            await session.exec(
                delete(Story).where(Story.dataset_version_id.in_(version_ids))
            )

            await session.exec(
                delete(Insight).where(Insight.dataset_version_id.in_(version_ids))
            )

        await session.exec(
            delete(Analysis).where(Analysis.dataset_id == dataset.id)
        )

        if dataset.raw_object_key:
            storage.delete_object(storage.bucket_raw, dataset.raw_object_key)

        await session.delete(dataset)

    await project_repo.delete(project)
