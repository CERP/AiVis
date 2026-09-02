from pydantic import BaseModel

from app.visualization.spec import VisualizationSpec


class VisualizationRecommendationResponse(BaseModel):
    story_id: str
    title: str
    analytical_question: str
    explanation: str
    why_recommended: str
    spec: VisualizationSpec
    confidence: float


class RecommendationsResponse(BaseModel):
    top: list[VisualizationRecommendationResponse]
    derived: list[VisualizationRecommendationResponse]
