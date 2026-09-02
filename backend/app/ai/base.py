"""AIProvider abstraction. Nothing outside app/ai/ should import a provider SDK directly —
callers depend on this interface so swapping Gemini for OpenAI/Claude later needs no changes
outside this package. See AI_ARCHITECTURE.md.

The interface deliberately has no concept of "conversation" or "chat" — every call is a single
structured request/response, because the current phase's AI responsibilities (semantic
interpretation, cleaning suggestions, insight/visualization/theme ranking) are one-shot
classification/generation tasks, not dialogue. The future chatbot (Phase 2, not implemented)
will build on top of this, not replace it.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class AIProviderError(Exception):
    """Raised for any provider failure: network error, invalid response, schema mismatch
    after retries. Callers should treat this as "AI is unavailable" and fall back to
    deterministic behavior — never crash a request because the AI layer is down."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class AIProvider(ABC):
    """A provider turns a system instruction + user content into a validated Pydantic model.
    It never receives raw datasets — only profiler-derived summaries built by
    app/ai/context_builder.py. It never returns anything that gets executed as code."""

    @abstractmethod
    async def generate_structured(
        self,
        *,
        system_instruction: str,
        prompt: str,
        response_schema: type[SchemaT],
    ) -> SchemaT:
        """Returns an instance of `response_schema`, validated. Raises AIProviderError on
        any failure (network, invalid JSON, schema validation failure after retry)."""
        raise NotImplementedError
