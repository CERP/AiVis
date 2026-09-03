"""Direct tests of GeminiProvider's own retry/validation logic -- previously only the
`AIProvider` interface was exercised (via `FakeProvider` doubles in test_ai_interpretation.py /
test_ai_findings.py), which bypasses `GeminiProvider.generate_structured()` entirely. These
mock the SDK boundary (`genai.Client`) so the actual retry-on-malformed-JSON, retry-on-empty,
and give-up-after-N-attempts behavior is verified against real code, not just the interface."""

import pytest
from pydantic import BaseModel

from app.ai import gemini_provider as gemini_provider_module
from app.ai.base import AIProviderError
from app.ai.gemini_provider import GeminiProvider

pytestmark = pytest.mark.asyncio


class _FakeResponse:
    def __init__(self, text: str | None) -> None:
        self.text = text


class _FakeModels:
    def __init__(self, responses: list) -> None:
        self._responses = list(responses)
        self.calls = 0

    def generate_content(self, *, model, contents, config):
        self.calls += 1
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class _FakeClient:
    def __init__(self, responses: list) -> None:
        self.models = _FakeModels(responses)


class _Schema(BaseModel):
    value: str


def _provider_with_responses(monkeypatch: pytest.MonkeyPatch, responses: list) -> GeminiProvider:
    fake_client = _FakeClient(responses)
    monkeypatch.setattr(gemini_provider_module.genai, "Client", lambda api_key: fake_client)
    return GeminiProvider(api_key="fake-key", model="gemini-test")


async def test_valid_response_on_first_attempt(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _provider_with_responses(
        monkeypatch, [_FakeResponse(text='{"value": "ok"}')]
    )
    result = await provider.generate_structured(
        system_instruction="sys", prompt="p", response_schema=_Schema
    )
    assert result == _Schema(value="ok")
    assert provider._client.models.calls == 1  # noqa: SLF001


async def test_malformed_json_retries_then_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _provider_with_responses(
        monkeypatch,
        [_FakeResponse(text="not json at all"), _FakeResponse(text="still not json")],
    )
    with pytest.raises(AIProviderError, match="failed to produce a valid"):
        await provider.generate_structured(
            system_instruction="sys", prompt="p", response_schema=_Schema
        )
    assert provider._client.models.calls == 2  # noqa: SLF001 -- both attempts consumed


async def test_valid_json_wrong_schema_retries_then_raises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Valid JSON, but missing the required field -- a Pydantic ValidationError, not a JSON
    # decode error; must be caught by the same retry path.
    provider = _provider_with_responses(
        monkeypatch,
        [_FakeResponse(text='{"wrong_field": 1}'), _FakeResponse(text='{"wrong_field": 2}')],
    )
    with pytest.raises(AIProviderError):
        await provider.generate_structured(
            system_instruction="sys", prompt="p", response_schema=_Schema
        )


async def test_empty_response_treated_as_failure_and_retried(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # response.text is None -- this is also what a safety-refusal response looks like from the
    # SDK (no text, no exception raised) -- must not crash, must retry then fail cleanly.
    provider = _provider_with_responses(
        monkeypatch, [_FakeResponse(text=None), _FakeResponse(text=None)]
    )
    with pytest.raises(AIProviderError, match="failed to produce a valid"):
        await provider.generate_structured(
            system_instruction="sys", prompt="p", response_schema=_Schema
        )


async def test_sdk_exception_is_caught_and_retried_not_crashed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Simulates a network error / timeout / rate-limit exception the SDK might raise.
    provider = _provider_with_responses(
        monkeypatch, [TimeoutError("simulated timeout"), _FakeResponse(text='{"value": "ok"}')]
    )
    result = await provider.generate_structured(
        system_instruction="sys", prompt="p", response_schema=_Schema
    )
    assert result == _Schema(value="ok")


async def test_recovers_on_second_attempt_after_first_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = _provider_with_responses(
        monkeypatch, [_FakeResponse(text="garbage"), _FakeResponse(text='{"value": "recovered"}')]
    )
    result = await provider.generate_structured(
        system_instruction="sys", prompt="p", response_schema=_Schema
    )
    assert result.value == "recovered"
