from pydantic import BaseModel

from app.visualization.spec import VisualizationSpec


class VisualizationRecommendationResponse(BaseModel):
    story_id: str
    title: str
    description: str
    spec: VisualizationSpec
    confidence: float


class RecommendationsResponse(BaseModel):
    top: list[VisualizationRecommendationResponse]
    shortfall_reason: str | None = None
