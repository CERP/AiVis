from __future__ import annotations

import uuid

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.base import AIProvider
from app.models.visualization import Visualization, VisualizationVersion
from app.repositories.dataset import DatasetColumnRepository
from app.repositories.visualization import VisualizationRepository, VisualizationVersionRepository
from app.services.nl_studio_edit import analyze_nl_studio_edit, to_visualization_command
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
    change_summary: str | None = None,
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
            change_summary=change_summary or f"Applied {command.type.value}",
            created_by=created_by,
        )
    )

    visualization.current_version_id = new_version.id
    session.add(visualization)
    await session.commit()
    return new_version


async def apply_nl_edit_to_visualization(
    session: AsyncSession,
    *,
    visualization: Visualization,
    provider: AIProvider,
    query: str,
) -> VisualizationVersion:
    """Natural-language studio edit: Gemini translates `query` into one StudioEditCommand
    against the visualization's current spec, which is then applied through the exact same
    deterministic, validated path as a manual studio command -- see
    app/services/nl_studio_edit.py for why a full spec is never trusted directly from Gemini."""
    version_repo = VisualizationVersionRepository(session)
    latest = await version_repo.get_latest(visualization.id)
    if latest is None:
        raise ValueError("Visualization has no versions")

    current_spec = VisualizationSpec.model_validate(latest.spec)
    semantic_types = await _get_column_semantic_types(
        session, uuid.UUID(current_spec.metadata.dataset_version_id)
    )

    edit = await analyze_nl_studio_edit(
        provider, spec=current_spec, column_semantic_types=semantic_types, query=query
    )
    command = to_visualization_command(edit)

    return await apply_command_to_visualization(
        session,
        visualization=visualization,
        command=command,
        created_by="ai",
        change_summary=edit.explanation,
    )


__all__ = [
    "VisualizationValidationError",
    "create_visualization",
    "apply_command_to_visualization",
    "apply_nl_edit_to_visualization",
]
