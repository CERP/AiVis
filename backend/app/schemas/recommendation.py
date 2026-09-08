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
