from app.visualization.themes import THEME_REGISTRY, contrast_ratio, list_themes, rank_themes


def test_all_themes_meet_wcag_aa_contrast() -> None:
    for theme in list_themes():
        ratio = contrast_ratio(theme.background, theme.foreground)
        assert ratio >= 4.5, f"{theme.name} contrast {ratio:.2f} below WCAG AA"


def test_registry_has_at_least_twelve_named_themes() -> None:
    assert len(THEME_REGISTRY) >= 12


def test_rank_themes_splits_top_and_rest() -> None:
    top, rest = rank_themes(top_n=8)
    assert len(top) == 8
    assert len(rest) == len(THEME_REGISTRY) - 8
    assert set(t.name for t in top) | set(t.name for t in rest) == set(THEME_REGISTRY.keys())


def test_rank_themes_is_sorted_descending_by_score() -> None:
    top, _rest = rank_themes()
    scores = [t.editorial_suitability_score for t in top]
    assert scores == sorted(scores, reverse=True)


def test_contrast_ratio_black_on_white_is_max() -> None:
    assert contrast_ratio("#000000", "#ffffff") == 21.0
