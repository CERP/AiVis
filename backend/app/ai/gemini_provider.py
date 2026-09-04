from __future__ import annotations

import asyncio
import logging
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.ai.base import AIProvider, AIProviderError

logger = logging.getLogger("aivis.ai.gemini")

SchemaT = TypeVar("SchemaT", bound=BaseModel)

_MAX_ATTEMPTS = 2
_TEMPERATURE = 0.1
"""Low temperature for fast, predictable structured output -- these are one-shot
classification/generation calls, not creative writing, so low variance is what we want."""
_MAX_OUTPUT_TOKENS = 2500
"""Caps generation length -- every schema here returns at most 8 short structured items, so
there's no legitimate reason for a response to run long; capping bounds worst-case latency.
1200 (an earlier, tighter value) was verified to truncate real 8-item ChartRecommendations
responses mid-JSON-string, causing spurious validation failures -- 2500 was verified against
live responses to leave headroom without meaningfully raising latency."""


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

        for attempt in range(_MAX_ATTEMPTS):
            logger.debug(
                "gemini request model=%s schema=%s attempt=%d/%d prompt=%s",
                self._model, response_schema.__name__, attempt + 1, _MAX_ATTEMPTS, prompt,
            )
            try:
                # The SDK's generate_content is a blocking network call -- run it off the event
                # loop so FastAPI can keep serving other requests while Gemini responds.
                response = await asyncio.to_thread(
                    self._client.models.generate_content,
                    model=self._model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        temperature=_TEMPERATURE,
                        max_output_tokens=_MAX_OUTPUT_TOKENS,
                    ),
                )
            except Exception as exc:  # noqa: BLE001 — any SDK/network failure is provider-level
                logger.debug("gemini request failed: %r", exc)
                last_error = exc
                continue

            logger.debug("gemini raw response schema=%s body=%s", response_schema.__name__, response.text)

            if response.text is None:
                last_error = AIProviderError("Empty response from Gemini")
                continue

            try:
                return response_schema.model_validate_json(response.text)
            except ValidationError as exc:
                logger.debug("gemini response failed schema validation: %r", exc)
                last_error = exc
                continue

        raise AIProviderError(
            f"Gemini failed to produce a valid {response_schema.__name__} after "
            f"{_MAX_ATTEMPTS} attempts: {last_error}"
        )
