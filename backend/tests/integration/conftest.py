from collections.abc import AsyncGenerator

import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

import app.models  # noqa: F401  registers tables on SQLModel.metadata

TEST_DATABASE_URL = "postgresql+asyncpg://aivis:aivis@localhost:55433/aivis"


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as s:
        yield s

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()
