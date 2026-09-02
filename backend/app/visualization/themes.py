"""Editorial theme token system. Conceptual themes inspired by data-journalism principles
(clarity, restraint, hierarchy) -- not a copy of any outlet's actual branding, typography, or
layout. Palettes use the Okabe-Ito colorblind-safe categorical set (or derivations of it) and
every text/background pair meets WCAG AA contrast (4.5:1) at the sizes used, checked by
_contrast_ratio below rather than assumed.
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


# Okabe-Ito: colorblind-safe, widely cited categorical palette (Okabe & Ito, 2008).
OKABE_ITO = [
    "#E69F00",  # orange
    "#56B4E9",  # sky blue
    "#009E73",  # bluish green
    "#F0E442",  # yellow
    "#0072B2",  # blue
    "#D55E00",  # vermillion
    "#CC79A7",  # reddish purple
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
    categorical_colors: list[str] = field(default_factory=lambda: list(OKABE_ITO))
    sequential_range: tuple[str, str] = ("#f7f7f7", "#08306b")
    diverging_range: tuple[str, str, str] = ("#b2182b", "#f7f7f7", "#2166ac")
    positive_color: str = "#2f6b4f"
    negative_color: str = "#b5432a"
    headline_font: str = "Georgia, serif"
    body_font: str = "system-ui, sans-serif"
    editorial_suitability_score: float = 0.5
    """Rough prior for ranking (Phase 20-002) -- how broadly applicable this theme is across
    dataset domains, not a measured metric. Domain-specific themes (Financial, Climate, ...)
    score lower here and would need dataset-domain matching (not built) to rank appropriately
    for their intended use case; documented as a known limitation."""


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
            description="Clean, restrained, maximum whitespace.",
            palette_type="categorical",
            background="#ffffff",
            foreground="#1a1815",
            grid="#e4e0d8",
            border="#cfc9bb",
            editorial_suitability_score=0.9,
        ),
        _theme(
            name="classic_editorial",
            description="Warm off-white background, serif-forward, newspaper-inspired.",
            palette_type="categorical",
            background="#fbfaf8",
            foreground="#1a1815",
            grid="#e4e0d8",
            border="#cfc9bb",
            editorial_suitability_score=0.85,
        ),
        _theme(
            name="investigative",
            description="High-contrast, serious, restrained accent use.",
            palette_type="categorical",
            background="#f4f2ee",
            foreground="#14130f",
            grid="#d8d3c6",
            border="#a89f8a",
            categorical_colors=["#8b0000", *OKABE_ITO[:5]],
            editorial_suitability_score=0.6,
        ),
        _theme(
            name="financial",
            description="Positive/negative-aware, precise, muted categorical accents.",
            palette_type="diverging",
            background="#ffffff",
            foreground="#0f1a2b",
            grid="#dfe3e8",
            border="#b9c2cc",
            positive_color="#0a7d3c",
            negative_color="#c1121f",
            editorial_suitability_score=0.5,
        ),
        _theme(
            name="scientific",
            description="Sequential-friendly, precise gridlines, cool palette.",
            palette_type="sequential",
            background="#ffffff",
            foreground="#101820",
            grid="#dce3e8",
            border="#aebcc7",
            sequential_range=("#eff3ff", "#08519c"),
            editorial_suitability_score=0.5,
        ),
        _theme(
            name="climate",
            description="Diverging warm/cool for anomaly-style data.",
            palette_type="diverging",
            background="#ffffff",
            foreground="#14231f",
            grid="#dde6e2",
            border="#a9beb6",
            diverging_range=("#67001f", "#f7f7f7", "#053061"),
            editorial_suitability_score=0.4,
        ),
        _theme(
            name="election",
            description="Two/multi-party categorical contrast.",
            palette_type="categorical",
            background="#ffffff",
            foreground="#1a1a1a",
            grid="#e2e2e2",
            border="#bdbdbd",
            categorical_colors=["#0072B2", "#D55E00", "#009E73", "#CC79A7", *OKABE_ITO],
            editorial_suitability_score=0.3,
        ),
        _theme(
            name="sports",
            description="Energetic categorical accents, bold on white.",
            palette_type="categorical",
            background="#ffffff",
            foreground="#111111",
            grid="#e8e8e8",
            border="#c4c4c4",
            categorical_colors=["#0072B2", "#E69F00", "#009E73", *OKABE_ITO],
            editorial_suitability_score=0.3,
        ),
        _theme(
            name="economic",
            description="Sober sequential/diverging for macro indicators.",
            palette_type="sequential",
            background="#fbfaf8",
            foreground="#1a1815",
            grid="#e4e0d8",
            border="#cfc9bb",
            sequential_range=("#fff5eb", "#7f2704"),
            editorial_suitability_score=0.4,
        ),
        _theme(
            name="monochrome",
            description="Single-hue, emphasis via value not color.",
            palette_type="sequential",
            background="#ffffff",
            foreground="#111111",
            grid="#e5e5e5",
            border="#bfbfbf",
            categorical_colors=["#111111", "#3d3d3d", "#6b6b6b", "#9a9a9a", "#c4c4c4"],
            sequential_range=("#f5f5f5", "#111111"),
            editorial_suitability_score=0.55,
        ),
        _theme(
            name="high_contrast",
            description="Maximum legibility, accessibility-first.",
            palette_type="categorical",
            background="#ffffff",
            foreground="#000000",
            grid="#000000",
            border="#000000",
            categorical_colors=OKABE_ITO,
            editorial_suitability_score=0.7,
        ),
        _theme(
            name="dark_editorial",
            description="Dark background, warm accent, editorial dark mode.",
            palette_type="categorical",
            background="#14130f",
            foreground="#ece8de",
            grid="#322e25",
            border="#423d31",
            categorical_colors=["#e0673f", "#56B4E9", "#6fbd94", "#F0E442", *OKABE_ITO[4:]],
            positive_color="#6fbd94",
            negative_color="#e0673f",
            editorial_suitability_score=0.65,
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
