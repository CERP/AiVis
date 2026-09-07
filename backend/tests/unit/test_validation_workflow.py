import polars as pl
import pytest

from app.ai.schemas import DynamicTransformStep
from app.services.validation_workflow import execute_recipe


def step(action: str, column: str | None = None, **params) -> DynamicTransformStep:
    return DynamicTransformStep(
        column_name=column, action_type=action, reason="Gemini identified an inconsistency",
        params=params,
    )


def test_clean_class_7_quiz_dataset_is_unchanged() -> None:
    frame = pl.DataFrame({"student": ["A", "B"], "quiz_1": [82, 91]})
    result = execute_recipe(frame, [])
    assert result.dataframe.equals(frame)
    assert result.changed_cells == 0
    assert result.validation_errors == []


def test_inconsistent_categories_and_whitespace_are_gemini_driven() -> None:
    frame = pl.DataFrame({"section": [" a", "A", "a "]})
    result = execute_recipe(frame, [
        step("trim_strings", "section"),
        step("standardize_case", "section", case="upper"),
    ])
    assert result.dataframe["section"].to_list() == ["A", "A", "A"]
    assert result.changed_rows == 2


def test_missing_values_can_be_filled_by_declared_recipe() -> None:
    frame = pl.DataFrame({"score": [70.0, None, 90.0]})
    result = execute_recipe(frame, [step("fill_missing", "score", method="mean")])
    assert result.dataframe["score"].to_list() == [70.0, 80.0, 90.0]


def test_only_exact_duplicate_rows_can_be_removed() -> None:
    frame = pl.DataFrame({"student": ["A", "A", "B"], "score": [80, 80, 90]})
    result = execute_recipe(frame, [step("dedupe_rows")])
    assert result.dataframe.height == 2
    assert result.removed_rows == 1
    rejected = execute_recipe(frame, [step("dedupe_rows", subset=["student"])])
    assert "exact full-row duplicates" in rejected.validation_errors[0]


def test_numeric_strings_and_percentages_parse_without_data_loss() -> None:
    frame = pl.DataFrame({"score": ["10", "20"], "rate": ["25%", "0.5"]})
    result = execute_recipe(frame, [
        step("coerce_numeric", "score"), step("normalize_percentage", "rate")
    ])
    assert result.dataframe["score"].to_list() == [10.0, 20.0]
    assert result.dataframe["rate"].to_list() == [0.25, 0.5]
    assert result.validation_errors == []


@pytest.mark.parametrize("invalid", [105, -3])
def test_ambiguous_out_of_range_values_are_not_changed_without_a_recipe(invalid: int) -> None:
    frame = pl.DataFrame({"quiz_2": [80, invalid]})
    assert execute_recipe(frame, []).dataframe["quiz_2"].to_list() == [80, invalid]


def test_unparseable_value_rejects_entire_candidate() -> None:
    frame = pl.DataFrame({"score": ["10", "unknown"]})
    result = execute_recipe(frame, [step("coerce_numeric", "score")])
    assert any("readable value" in error for error in result.validation_errors)


def test_cleaned_sample_must_match_recipe() -> None:
    frame = pl.DataFrame({"section": [" a"]})
    result = execute_recipe(
        frame,
        [step("trim_strings", "section")],
        [{"__row_index": 0, "section": "invented"}],
    )
    assert any("inconsistent" in error for error in result.validation_errors)
