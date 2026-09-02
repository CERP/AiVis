from fastapi import APIRouter

from app.schemas.theme import ThemeRecommendationsResponse, ThemeResponse
from app.visualization.themes import list_themes, rank_themes

router = APIRouter(prefix="/themes", tags=["themes"])


@router.get("", response_model=list[ThemeResponse])
async def list_themes_route() -> list[ThemeResponse]:
    return [ThemeResponse(**t.__dict__) for t in list_themes()]


@router.get("/recommendations", response_model=ThemeRecommendationsResponse)
async def theme_recommendations_route() -> ThemeRecommendationsResponse:
    top, rest = rank_themes()
    return ThemeRecommendationsResponse(
        top=[ThemeResponse(**t.__dict__) for t in top],
        rest=[ThemeResponse(**t.__dict__) for t in rest],
    )
