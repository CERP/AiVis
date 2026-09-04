"""Audit test suite for the Gemini-first recommendation architecture. Verifies, against the
real FastAPI app + DB (not isolated unit fakes), the three claims the architecture audit is
required to prove:
  1. The recommendation count is hard-capped at 8, even for a wide dataset.
  2. Gemini's SDK is actually invoked during the analysis pipeline, with schema-constrained
     output, and its output can reach the final recommendation list.
  3. There is currently no POST /api/v1/datasets/{id}/clean/preview endpoint -- that part of
     the original directive (Stage 1, data-quality audit + before/after diff) was never built.
     This test documents the gap rather than silently skipping it.
"""

import io
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.base import AIProvider, AIProviderError
from app.ai.schemas import AnalyticalFindings, ChartRecommendation, ChartRecommendations
from app.core.db import get_session
from app.main import app
from app.repositories.analysis import AnalysisRepository
from app.repositories.dataset import DatasetVersionRepository
from app.services.analysis_orchestrator import run_analysis
from app.services.storage import get_storage_service

pytestmark = pytest.mark.asyncio

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.fixture
def client(session: AsyncSession) -> AsyncClient:
    async def _get_session_override() -> AsyncSession:
        return session

    app.dependency_overrides[get_session] = _get_session_override
    get_storage_service().ensure_buckets()
    try:
        transport = ASGITransport(app=app)
        yield AsyncClient(transport=transport, base_url="http://test")
    finally:
        app.dependency_overrides.clear()


def _wide_csv() -> bytes:
    """15 numeric/categorical columns, 20 rows -- enough surface area that the old
    combinatorial-loop implementation would have generated hundreds of candidate charts."""
    numeric_cols = [f"metric_{i}" for i in range(8)]
    categorical_cols = [f"category_{i}" for i in range(7)]
    header = ",".join(["row_id", *numeric_cols, *categorical_cols])
    lines = [header]
    for r in range(20):
        numeric_vals = [str((r * 7 + i * 3) % 97) for i in range(8)]
        categorical_vals = [f"group_{(r + i) % 4}" for i in range(7)]
        lines.append(",".join([str(r), *numeric_vals, *categorical_vals]))
    return ("\n".join(lines) + "\n").encode()


async def _signup_and_upload(c: AsyncClient, email: str, filename: str, content: bytes) -> tuple[dict, dict]:
    signup = await c.post(
        "/api/auth/signup",
        json={"email": email, "password": "supersecret1", "organization_name": "Audit Co"},
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project = await c.post("/api/projects", json={"name": "P"}, headers=headers)
    project_id = project.json()["id"]

    dataset_resp = await c.post(
        "/api/datasets",
        params={"project_id": project_id},
        files={"file": (filename, io.BytesIO(content), "text/csv")},
        headers=headers,
    )
    return dataset_resp.json(), headers


class FakeChartRecProvider(AIProvider):
    """Records exactly how it was called -- proves the SDK boundary receives a schema-
    constrained request, without hitting the real network in a CI-safe test."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, type]] = []

    async def generate_structured(self, *, system_instruction, prompt, response_schema):
        self.calls.append((system_instruction, response_schema))
        if response_schema is ChartRecommendations:
            return ChartRecommendations(
                recommendations=[
                    # bump requires x+y+color together -- no deterministic detector in this
                    # pipeline produces a 3-field temporal+categorical-color combo, so this is
                    # guaranteed not to collide with (and lose to) a Story-derived duplicate.
                    ChartRecommendation(
                        rank=1,
                        chart_type="bump",
                        title="Revenue rank over time by product",
                        description="desc",
                        reason="temporal trend of a continuous measure, split by product",
                        x_field="date",
                        y_field="revenue",
                        color_field="product",
                        aggregate="mean",
                        confidence=0.99,  # highest confidence -- must survive to the top of the list
                    )
                ]
            )
        return AnalyticalFindings(findings=[])


async def test_recommendation_count_never_exceeds_eight_for_wide_dataset(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.analysis_orchestrator.get_ai_provider",
        lambda: FakeChartRecProvider(),
    )

    async with client as c:
        dataset, headers = await _signup_and_upload(
            c, "wide@example.com", "wide.csv", _wide_csv()
        )

        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.claim_next_queued()
        version = await DatasetVersionRepository(session).get(analysis.dataset_version_id)
        await run_analysis(session, analysis, version)

        resp = await c.get(f"/api/datasets/{dataset['id']}/analysis", headers=headers)
        body = resp.json()
        assert body["status"] == "ready", body
        recs = body["recommendations"]["top"]
        assert len(recs) <= 8, f"expected <=8, got {len(recs)}"
        assert len(recs) < 100, "old combinatorial-loop behavior would have produced 100+"


async def test_gemini_sdk_invoked_with_schema_constrained_request_and_reaches_output(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Proves two things in one pass: (1) the provider boundary is actually called with the
    ChartRecommendations schema during the real orchestrator run, and (2) a high-confidence
    Gemini-sourced spec survives dedup/ranking/truncation into the final response, tagged with
    generated_by='gemini'."""
    provider = FakeChartRecProvider()
    monkeypatch.setattr(
        "app.services.analysis_orchestrator.get_ai_provider", lambda: provider
    )

    async with client as c:
        dataset, headers = await _signup_and_upload(c, "sdk@example.com", "clean.csv", (FIXTURES / "clean.csv").read_bytes())

        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.claim_next_queued()
        version = await DatasetVersionRepository(session).get(analysis.dataset_version_id)
        await run_analysis(session, analysis, version)

        resp = await c.get(f"/api/datasets/{dataset['id']}/analysis", headers=headers)
        recs = resp.json()["recommendations"]["top"]

    schemas_called = {schema for _instr, schema in provider.calls}
    assert ChartRecommendations in schemas_called, "Gemini SDK boundary never received a ChartRecommendations request"
    assert AnalyticalFindings in schemas_called

    gemini_recs = [r for r in recs if r["spec"]["metadata"]["generated_by"] == "gemini"]
    assert gemini_recs, "no Gemini-sourced recommendation reached the final response"
    assert gemini_recs[0]["spec"]["metadata"]["reasoning"] == (
        "temporal trend of a continuous measure, split by product"
    )


async def test_ai_provider_failure_degrades_to_deterministic_only_never_crashes_or_dumps(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Fallback/mock-prevention check: a broken Gemini call (invalid key / SDK exception) must
    degrade to deterministic-only recommendations -- never a 500, never an unbounded dump."""

    class FailingProvider(AIProvider):
        async def generate_structured(self, *, system_instruction, prompt, response_schema):
            raise AIProviderError("simulated invalid API key")

    monkeypatch.setattr(
        "app.services.analysis_orchestrator.get_ai_provider", lambda: FailingProvider()
    )

    async with client as c:
        dataset, headers = await _signup_and_upload(c, "fail@example.com", "clean.csv", (FIXTURES / "clean.csv").read_bytes())

        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.claim_next_queued()
        version = await DatasetVersionRepository(session).get(analysis.dataset_version_id)
        await run_analysis(session, analysis, version)  # must not raise

        resp = await c.get(f"/api/datasets/{dataset['id']}/analysis", headers=headers)
        body = resp.json()
        assert body["status"] == "ready"
        recs = body["recommendations"]["top"]
        assert len(recs) <= 8
        assert all(r["spec"]["metadata"]["generated_by"] == "deterministic" for r in recs)


async def test_clean_preview_returns_accurate_before_after_diff(client: AsyncClient) -> None:
    """POST /clean/preview must return a real before/after diff computed from the current
    version's data, and must not create a new DatasetVersion or touch the original."""
    async with client as c:
        dataset, headers = await _signup_and_upload(
            c, "preview@example.com", "clean.csv", (FIXTURES / "clean.csv").read_bytes()
        )
        profile_before = await c.get(f"/api/datasets/{dataset['id']}/profile", headers=headers)
        version_before = profile_before.json()["dataset_version_id"]

        resp = await c.post(
            f"/api/datasets/{dataset['id']}/clean/preview",
            json={"operation_type": "standardize_case", "column_name": "region", "params": {"case": "upper"}},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["column"] == "region"
        assert body["affected_rows_count"] >= 0
        for entry in body["sample_diff"]:
            assert isinstance(entry["before"], str) or entry["before"] is None
            assert isinstance(entry["after"], str) or entry["after"] is None
            assert entry["after"] == entry["before"].upper()

        # non-destructive: no new version was created by a preview call
        profile_after = await c.get(f"/api/datasets/{dataset['id']}/profile", headers=headers)
        assert profile_after.json()["dataset_version_id"] == version_before
