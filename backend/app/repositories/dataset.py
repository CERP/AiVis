import uuid

from sqlmodel import select

from app.models.dataset import (
    CleaningOperation,
    DataProfile,
    Dataset,
    DatasetColumn,
    DatasetVersion,
)
from app.repositories.base import BaseRepository


class DatasetRepository(BaseRepository[Dataset]):
    model = Dataset

    async def list_for_project(self, project_id: uuid.UUID) -> list[Dataset]:
        result = await self.session.exec(select(Dataset).where(Dataset.project_id == project_id))
        return list(result.all())


class DatasetVersionRepository(BaseRepository[DatasetVersion]):
    model = DatasetVersion

    async def list_for_dataset(self, dataset_id: uuid.UUID) -> list[DatasetVersion]:
        result = await self.session.exec(
            select(DatasetVersion)
            .where(DatasetVersion.dataset_id == dataset_id)
            .order_by(DatasetVersion.version_number)
        )
        return list(result.all())

    async def get_latest(self, dataset_id: uuid.UUID) -> DatasetVersion | None:
        result = await self.session.exec(
            select(DatasetVersion)
            .where(DatasetVersion.dataset_id == dataset_id)
            .order_by(DatasetVersion.version_number.desc())
            .limit(1)
        )
        return result.first()


class DatasetColumnRepository(BaseRepository[DatasetColumn]):
    model = DatasetColumn

    async def list_for_version(self, dataset_version_id: uuid.UUID) -> list[DatasetColumn]:
        result = await self.session.exec(
            select(DatasetColumn)
            .where(DatasetColumn.dataset_version_id == dataset_version_id)
            .order_by(DatasetColumn.ordinal)
        )
        return list(result.all())


class DataProfileRepository(BaseRepository[DataProfile]):
    model = DataProfile

    async def get_by_column(self, dataset_column_id: uuid.UUID) -> DataProfile | None:
        result = await self.session.exec(
            select(DataProfile).where(DataProfile.dataset_column_id == dataset_column_id)
        )
        return result.first()


class CleaningOperationRepository(BaseRepository[CleaningOperation]):
    model = CleaningOperation

    async def list_for_version(self, dataset_version_id: uuid.UUID) -> list[CleaningOperation]:
        result = await self.session.exec(
            select(CleaningOperation).where(
                CleaningOperation.dataset_version_id == dataset_version_id
            )
        )
        return list(result.all())
