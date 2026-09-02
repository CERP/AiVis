import uuid

from sqlmodel import select

from app.models.user import Membership, Organization
from app.repositories.base import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    model = Organization

    async def get_by_slug(self, slug: str) -> Organization | None:
        result = await self.session.exec(select(Organization).where(Organization.slug == slug))
        return result.first()


class MembershipRepository(BaseRepository[Membership]):
    model = Membership

    async def list_for_user(self, user_id: uuid.UUID) -> list[Membership]:
        result = await self.session.exec(select(Membership).where(Membership.user_id == user_id))
        return list(result.all())
