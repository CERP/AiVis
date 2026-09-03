# AI Architecture

## Scope (current phase)

AI is used for: dataset semantic interpretation, cleaning/structuring suggestions, insight
discovery assistance, visualization recommendations/ranking, theme recommendations.

AI is **not** used for: chatbot, conversational chart editing, an autonomous agent, or
natural-language commands. That is Phase 2 and is not implemented.

## Provider abstraction

```
AIProvider (interface)
├── GeminiProvider   (implemented)
├── OpenAIProvider   (future)
└── ClaudeProvider   (future)
```

`backend/app/ai/base.py` defines the interface; nothing outside `app/ai/` calls a provider SDK
directly. Callers depend on `AIProvider`, injected via config (`AI_PROVIDER` env var).

## Data minimization

```
Raw dataset → Local profiler (schema, stats, sample rows, distributions,
              cardinality, correlations) → AI
```

The AI never receives a full raw dataset. Sampling is configurable and PII/sensitive columns
detected by the profiler are excluded or redacted before any prompt is built
(`app/ai/context_builder.py`).

## Output safety

- Every AI response is validated against a Pydantic schema before use.
- Invalid/unparseable output is rejected, not silently coerced.
- AI-generated code is never executed. AI never mutates raw data directly — it produces
  transformation *recommendations* that the deterministic data engine executes
  (see `app/data/transforms.py`), and every execution is logged, validated, and reversible
  where possible.
- Prompt inputs are treated as adversarial: user-provided column names/values are never
  interpolated into instructions the model could interpret as commands.

## Future: AI Visualization Copilot (Phase 2, not implemented)

```
User → Chatbot → Intent parser → VisualizationCommand → Command validator
     → VisualizationService → new VisualizationSpec version → Renderer
```

`VisualizationCommand`, `VisualizationMutation`, and the versioned `VisualizationSpec` already
exist (Phase 14) so this can be added without restructuring the renderer, validator, or spec
model.
