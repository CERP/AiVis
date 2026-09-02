# Contributing

## Workflow

1. Check [task.md](task.md) for the current backlog — respect task dependencies.
2. Implement the smallest coherent unit for a task.
3. Test it (backend: `pytest`; frontend: `npm test` / manual browser check for UI).
4. Update `task.md`: `[ ]` → `[x]` with a short completion note, or `[~]`/`[!]` if partial/blocked.
5. Keep docs (`ARCHITECTURE.md`, `AI_ARCHITECTURE.md`, etc.) in sync with what you build.

## Code style

- Backend: `ruff check` + `mypy`, no bare `except`, no wildcard imports.
- Frontend: `npm run lint`, strict TypeScript, avoid `any`.
- No dead code, no speculative abstractions for features not yet built.

## Scope rule

Do not implement the AI Visualization Copilot (chatbot) — it is Phase 2. Keep the
`VisualizationCommand` / `AIProvider` extension points intact for it, but do not build chat UI,
chat APIs, or conversational chart editing.
