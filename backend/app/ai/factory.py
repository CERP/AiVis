from app.ai.base import AIProvider, AIProviderError
from app.ai.gemini_provider import GeminiProvider
from app.core.config import get_settings

_provider: AIProvider | None = None


def get_ai_provider() -> AIProvider:
    global _provider
    if _provider is not None:
        return _provider

    settings = get_settings()
    if settings.ai_provider == "gemini":
        _provider = GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)
    else:
        raise AIProviderError(f"Unknown AI provider: {settings.ai_provider}")
    return _provider
