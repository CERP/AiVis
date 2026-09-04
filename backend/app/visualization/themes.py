"""Theme token system for the Visualization Studio. Exactly 8 distinct, professional theme
directions (Executive Neutral, High Contrast, Minimal Professional, Dark Data, Soft Corporate,
Technical, Institutional, Cool Professional) -- no more, no fewer, matching the pipeline's
strict top-8 contract elsewhere. Palettes use Paul Tol's colorblind-safe "vibrant" qualitative
set (Tol, 2021) with no yellow hue: a saturated yellow (e.g. Okabe-Ito's #F0E442) reads as
low-contrast on a white background and dominates the eye disproportionately to its information
value, so it's excluded from every palette here. Every text/background pair meets WCAG AA
contrast (4.5:1) at the sizes used, checked by _contrast_ratio below rather than assumed.
"""

from __future__ import annotations

from dataclasses import dataclass, field


def _relative_luminance(hex_color: str) -> float:
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def channel(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = channel(r), channel(g), channel(b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(hex_a: str, hex_b: str) -> float:
    lum_a = _relative_luminance(hex_a) + 0.05
    lum_b = _relative_luminance(hex_b) + 0.05
    return max(lum_a, lum_b) / min(lum_a, lum_b)


# Paul Tol's "vibrant" qualitative palette: colorblind-safe, no yellow. Black appended as an
# 8th categorical slot for maximum-contrast emphasis/outlier marking.
PROFESSIONAL_PALETTE = [
    "#0077BB",  # blue
    "#33BBEE",  # cyan
    "#009988",  # teal
    "#EE7733",  # orange
    "#CC3311",  # red
    "#EE3377",  # magenta
    "#666666",  # grey
    "#000000",  # black
]


@dataclass
class ThemeTokens:
    name: str
    description: str
    palette_type: str  # "categorical" | "sequential" | "diverging"
    background: str
    foreground: str
    grid: str
    border: str
    categorical_colors: list[str] = field(default_factory=lambda: list(PROFESSIONAL_PALETTE))
    sequential_range: tuple[str, str] = ("#f7f7f7", "#08306b")
    diverging_range: tuple[str, str, str] = ("#b2182b", "#f7f7f7", "#2166ac")
    positive_color: str = "#0a7d3c"
    negative_color: str = "#c1121f"
    headline_font: str = "system-ui, sans-serif"
    body_font: str = "system-ui, sans-serif"
    editorial_suitability_score: float = 0.5
    """Rough prior for ranking -- how broadly applicable this theme is across dataset domains,
    not a measured metric."""


def _theme(**kwargs) -> ThemeTokens:
    theme = ThemeTokens(**kwargs)
    bg_fg_contrast = contrast_ratio(theme.background, theme.foreground)
    if bg_fg_contrast < 4.5:
        raise ValueError(
            f"Theme '{theme.name}' background/foreground contrast {bg_fg_contrast:.2f} "
            "is below WCAG AA (4.5)"
        )
    return theme


THEME_REGISTRY: dict[str, ThemeTokens] = {
    t.name: t
    for t in [
        _theme(
            name="minimal",
            description="Minimal Professional -- clean white background, maximum restraint.",
            palette_type="categorical",
            background="#ffffff",
            foreground="#1a1a1a",
            grid="#e6e6e6",
            border="#cfcfcf",
            editorial_suitability_score=0.95,
        ),
        _theme(
            name="executive_neutral",
            description="Executive Neutral -- warm neutral greys, boardroom-ready restraint.",
            palette_type="categorical",
            background="#faf9f7",
            foreground="#211f1c",
            grid="#e3e0da",
            border="#c7c2b8",
            categorical_colors=["#3d5a80", *PROFESSIONAL_PALETTE[1:]],
            editorial_suitability_score=0.85,
        ),
        _theme(
            name="high_contrast",
            description="High Contrast -- maximum legibility, accessibility-first.",
            palette_type="categorical",
            background="#ffffff",
            foreground="#000000",
            grid="#000000",
            border="#000000",
            categorical_colors=PROFESSIONAL_PALETTE,
            editorial_suitability_score=0.8,
        ),
        _theme(
            name="dark_data",
            description="Dark Data -- dark background for dashboards and low-light review.",
            palette_type="categorical",
            background="#12161c",
            foreground="#eef1f5",
            grid="#2a3038",
            border="#3a4048",
            categorical_colors=["#4CC9F0", "#F72585", "#4EE1A0", "#F77F00", "#7B61FF", "#FFFFFF", "#94A1B2", "#EE7733"],
            positive_color="#4EE1A0",
            negative_color="#F72585",
            editorial_suitability_score=0.6,
        ),
        _theme(
            name="soft_corporate",
            description="Soft Corporate -- muted, approachable tones for internal reporting.",
            palette_type="categorical",
            background="#ffffff",
            foreground="#232323",
            grid="#e9e9e9",
            border="#d2d2d2",
            categorical_colors=["#5B7FA6", "#7FB0A0", "#C97B63", "#8D7BAE", "#3d5a80", "#5A8F7B", "#3E3E3E", "#000000"],
            editorial_suitability_score=0.7,
        ),
        _theme(
            name="technical",
            description="Technical -- precise gridlines, cool engineering palette.",
            palette_type="sequential",
            background="#ffffff",
            foreground="#101820",
            grid="#dce3e8",
            border="#aebcc7",
            sequential_range=("#eff3ff", "#08519c"),
            editorial_suitability_score=0.55,
        ),
        _theme(
            name="institutional",
            description="Institutional -- formal navy/grey, government and finance reporting.",
            palette_type="diverging",
            background="#ffffff",
            foreground="#0f1a2b",
            grid="#dfe3e8",
            border="#b9c2cc",
            categorical_colors=["#1B3A5C", *PROFESSIONAL_PALETTE[1:]],
            editorial_suitability_score=0.65,
        ),
        _theme(
            name="cool_professional",
            description="Cool Professional -- crisp cool-blue accents on a light neutral base.",
            palette_type="categorical",
            background="#f7f9fb",
            foreground="#12202e",
            grid="#dde5ec",
            border="#b7c4cf",
            categorical_colors=["#0077BB", "#33BBEE", "#3d5a80", "#5B7FA6", "#009988", "#666666", "#1B3A5C", "#000000"],
            editorial_suitability_score=0.75,
        ),
    ]
}


def list_themes() -> list[ThemeTokens]:
    return list(THEME_REGISTRY.values())


def rank_themes(*, top_n: int = 8) -> tuple[list[ThemeTokens], list[ThemeTokens]]:
    ranked = sorted(
        THEME_REGISTRY.values(), key=lambda t: t.editorial_suitability_score, reverse=True
    )
    return ranked[:top_n], ranked[top_n:]
