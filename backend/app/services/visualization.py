from __future__ import annotations

import uuid

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.visualization import Visualization, VisualizationVersion
from app.repositories.dataset import DatasetColumnRepository
from app.repositories.visualization import VisualizationRepository, VisualizationVersionRepository
from app.visualization.commands import VisualizationCommand, apply_command
from app.visualization.spec import VisualizationSpec
from app.visualization.validation import ValidationResult, validate_spec


class VisualizationValidationError(Exception):
    def __init__(self, result: ValidationResult) -> None:
        self.result = result
        super().__init__("; ".join(result.errors))


async def _get_column_semantic_types(
    session: AsyncSession, dataset_version_id: uuid.UUID
) -> dict[str, str]:
    columns = await DatasetColumnRepository(session).list_for_version(dataset_version_id)
    return {c.name: c.semantic_type for c in columns if c.semantic_type}


async def create_visualization(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    title: str,
    story_id: uuid.UUID | None,
    spec: VisualizationSpec,
) -> tuple[Visualization, VisualizationVersion]:
    dataset_version_id = uuid.UUID(spec.metadata.dataset_version_id)
    semantic_types = await _get_column_semantic_types(session, dataset_version_id)
    result = validate_spec(spec, semantic_types)
    if not result.is_valid:
        raise VisualizationValidationError(result)

    viz_repo = VisualizationRepository(session)
    visualization = await viz_repo.create(
        Visualization(
            project_id=project_id,
            dataset_version_id=dataset_version_id,
            story_id=story_id,
            title=title,
        )
    )

    version_repo = VisualizationVersionRepository(session)
    version = await version_repo.create(
        VisualizationVersion(
            visualization_id=visualization.id,
            version_number=1,
            spec=spec.model_dump(mode="json"),
            change_summary="Initial version",
            created_by="system",
        )
    )

    visualization.current_version_id = version.id
    session.add(visualization)
    await session.commit()
    await session.refresh(visualization)
    return visualization, version


async def apply_command_to_visualization(
    session: AsyncSession,
    *,
    visualization: Visualization,
    command: VisualizationCommand,
    created_by: str = "user",
) -> VisualizationVersion:
    version_repo = VisualizationVersionRepository(session)
    latest = await version_repo.get_latest(visualization.id)
    if latest is None:
        raise ValueError("Visualization has no versions")

    current_spec = VisualizationSpec.model_validate(latest.spec)
    new_spec = apply_command(current_spec, command)

    semantic_types = await _get_column_semantic_types(
        session, uuid.UUID(new_spec.metadata.dataset_version_id)
    )
    result = validate_spec(new_spec, semantic_types)
    if not result.is_valid:
        raise VisualizationValidationError(result)

    new_version = await version_repo.create(
        VisualizationVersion(
            visualization_id=visualization.id,
            version_number=latest.version_number + 1,
            spec=new_spec.model_dump(mode="json"),
            change_summary=f"Applied {command.type.value}",
            created_by=created_by,
        )
    )

    visualization.current_version_id = new_version.id
    session.add(visualization)
    await session.commit()
    return new_version


__all__ = [
    "VisualizationValidationError",
    "create_visualization",
    "apply_command_to_visualization",
]
