import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel, select


class BaseRepository[ModelT: SQLModel]:
    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, id_: uuid.UUID) -> ModelT | None:
        return await self.session.get(self.model, id_)

    async def list(self, *, limit: int = 100, offset: int = 0) -> list[ModelT]:
        result = await self.session.exec(select(self.model).limit(limit).offset(offset))
        return list(result.all())

    async def create(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.commit()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.commit()
