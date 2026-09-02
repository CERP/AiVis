from sqlmodel import select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.exec(select(User).where(User.email == email))
        return result.first()
