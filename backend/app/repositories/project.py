import uuid

from sqlmodel import select

from app.models.project import Project
from app.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    model = Project

    async def list_for_organization(self, organization_id: uuid.UUID) -> list[Project]:
        result = await self.session.exec(
            select(Project).where(Project.organization_id == organization_id)
        )
        return list(result.all())
