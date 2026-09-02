from __future__ import annotations

from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.ai.base import AIProvider, AIProviderError

SchemaT = TypeVar("SchemaT", bound=BaseModel)

_MAX_ATTEMPTS = 2


class GeminiProvider(AIProvider):
    def __init__(self, *, api_key: str, model: str) -> None:
        if not api_key:
            raise AIProviderError("GEMINI_API_KEY is not configured")
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def generate_structured(
        self,
        *,
        system_instruction: str,
        prompt: str,
        response_schema: type[SchemaT],
    ) -> SchemaT:
        last_error: Exception | None = None

        for _attempt in range(_MAX_ATTEMPTS):
            try:
                response = self._client.models.generate_content(
                    model=self._model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                    ),
                )
            except Exception as exc:  # noqa: BLE001 — any SDK/network failure is provider-level
                last_error = exc
                continue

            if response.text is None:
                last_error = AIProviderError("Empty response from Gemini")
                continue

            try:
                return response_schema.model_validate_json(response.text)
            except ValidationError as exc:
                last_error = exc
                continue

        raise AIProviderError(
            f"Gemini failed to produce a valid {response_schema.__name__} after "
            f"{_MAX_ATTEMPTS} attempts: {last_error}"
        )
