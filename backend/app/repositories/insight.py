import uuid

from sqlmodel import select

from app.models.insight import Insight, Story
from app.repositories.base import BaseRepository


class InsightRepository(BaseRepository[Insight]):
    model = Insight

    async def list_for_version(self, dataset_version_id: uuid.UUID) -> list[Insight]:
        result = await self.session.exec(
            select(Insight)
            .where(Insight.dataset_version_id == dataset_version_id)
            .order_by(Insight.confidence.desc())
        )
        return list(result.all())


class StoryRepository(BaseRepository[Story]):
    model = Story

    async def list_for_version(self, dataset_version_id: uuid.UUID) -> list[Story]:
        result = await self.session.exec(
            select(Story)
            .where(Story.dataset_version_id == dataset_version_id)
            .order_by(Story.confidence.desc())
        )
        return list(result.all())
