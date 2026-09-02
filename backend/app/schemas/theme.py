from pydantic import BaseModel


class ThemeResponse(BaseModel):
    name: str
    description: str
    palette_type: str
    background: str
    foreground: str
    grid: str
    border: str
    categorical_colors: list[str]
    sequential_range: tuple[str, str]
    diverging_range: tuple[str, str, str]
    positive_color: str
    negative_color: str
    headline_font: str
    body_font: str


class ThemeRecommendationsResponse(BaseModel):
    top: list[ThemeResponse]
    rest: list[ThemeResponse]
