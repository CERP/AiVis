import uuid

from sqlmodel import select

from app.models.visualization import Visualization, VisualizationVersion
from app.repositories.base import BaseRepository


class VisualizationRepository(BaseRepository[Visualization]):
    model = Visualization

    async def list_for_project(self, project_id: uuid.UUID) -> list[Visualization]:
        result = await self.session.exec(
            select(Visualization).where(Visualization.project_id == project_id)
        )
        return list(result.all())


class VisualizationVersionRepository(BaseRepository[VisualizationVersion]):
    model = VisualizationVersion

    async def list_for_visualization(
        self, visualization_id: uuid.UUID
    ) -> list[VisualizationVersion]:
        result = await self.session.exec(
            select(VisualizationVersion)
            .where(VisualizationVersion.visualization_id == visualization_id)
            .order_by(VisualizationVersion.version_number)
        )
        return list(result.all())

    async def get_latest(self, visualization_id: uuid.UUID) -> VisualizationVersion | None:
        result = await self.session.exec(
            select(VisualizationVersion)
            .where(VisualizationVersion.visualization_id == visualization_id)
            .order_by(VisualizationVersion.version_number.desc())
            .limit(1)
        )
        return result.first()
