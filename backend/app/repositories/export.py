from app.models.export import Export
from app.repositories.base import BaseRepository


class ExportRepository(BaseRepository[Export]):
    model = Export
