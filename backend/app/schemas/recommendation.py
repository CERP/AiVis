from pydantic import BaseModel

from app.visualization.spec import VisualizationSpec


class VisualizationRecommendationResponse(BaseModel):
    story_id: str
    title: str
    description: str
    spec: VisualizationSpec
    confidence: float
    category: str = "other"


class RecommendationCategoryGroup(BaseModel):
    category: str
    recommendations: list[VisualizationRecommendationResponse]


class RecommendationsResponse(BaseModel):
    top: list[VisualizationRecommendationResponse]
    groups: list[RecommendationCategoryGroup]
    shortfall_reason: str | None = None


class FindingsWindowResponse(BaseModel):
    """A slice of the already-ranked, already-deduplicated `recommendations.top` list stored on
    Analysis -- never a re-ranking or a new Gemini call. Exists as its own endpoint rather than
    query params on GET .../analysis because that endpoint is polled by Overview/Cleaning/the
    legacy /recommend page for unrelated fields (status, data_quality); keeping pagination here
    means none of those callers need to change or think about offset/limit."""

    items: list[VisualizationRecommendationResponse]
    offset: int
    limit: int
    total: int
    next_offset: int | None = None
    has_more: bool = False
