from app.visualization.themes import THEME_REGISTRY, contrast_ratio, list_themes, rank_themes


def test_all_themes_meet_wcag_aa_contrast() -> None:
    for theme in list_themes():
        ratio = contrast_ratio(theme.background, theme.foreground)
        assert ratio >= 4.5, f"{theme.name} contrast {ratio:.2f} below WCAG AA"


def test_registry_has_exactly_eight_named_themes() -> None:
    """Strict contract: exactly 8 distinct theme directions, matching the pipeline's top-8 cap
    everywhere else -- no overflow list, no fewer than the full set."""
    assert len(THEME_REGISTRY) == 8


def test_no_theme_uses_a_yellow_hue() -> None:
    """Saturated yellow (e.g. #F0E442) reads as low-contrast on white and dominates the eye
    disproportionately -- excluded from every palette."""
    yellow_hues = {"#f0e442", "#ffff00", "#ffeb3b", "#fde407"}
    for theme in list_themes():
        colors = {c.lower() for c in theme.categorical_colors}
        assert not colors & yellow_hues, f"{theme.name} contains a yellow hue"


def test_rank_themes_splits_top_and_rest() -> None:
    top, rest = rank_themes(top_n=8)
    assert len(top) == 8
    assert rest == []
    assert set(t.name for t in top) == set(THEME_REGISTRY.keys())


def test_rank_themes_is_sorted_descending_by_score() -> None:
    top, _rest = rank_themes()
    scores = [t.editorial_suitability_score for t in top]
    assert scores == sorted(scores, reverse=True)


def test_contrast_ratio_black_on_white_is_max() -> None:
    assert contrast_ratio("#000000", "#ffffff") == 21.0
