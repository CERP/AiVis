"""Full automatic-pipeline integration test: upload -> Analysis auto-created -> orchestrator
runs every stage -> validated, persisted recommendations. Exercises the same code path the
background worker uses (AnalysisRepository.claim_next_queued + run_analysis), just invoked
inline instead of via the worker's poll loop, so the test stays fast and deterministic."""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.base import AIProvider, AIProviderError
from app.ai.schemas import AnalyticalFindings
from app.core.db import get_session
from app.main import app
from app.repositories.analysis import AnalysisRepository
from app.repositories.dataset import DatasetVersionRepository
from app.services.analysis_orchestrator import run_analysis
from app.services.storage import get_storage_service

pytestmark = pytest.mark.asyncio

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


class FakeFindingsProvider(AIProvider):
    def __init__(self, response: AnalyticalFindings | None = None, fail: bool = False):
        self._response = response if response is not None else AnalyticalFindings(findings=[])
        self._fail = fail

    async def generate_structured(self, *, system_instruction, prompt, response_schema):
        if self._fail:
            raise AIProviderError("simulated Gemini failure")
        return self._response


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


async def _signup_and_upload(c: AsyncClient, email: str, fixture_name: str) -> tuple[dict, dict]:
    signup = await c.post(
        "/api/auth/signup",
        json={"email": email, "password": "supersecret1", "organization_name": "Pipeline Co"},
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project = await c.post("/api/projects", json={"name": "P"}, headers=headers)
    project_id = project.json()["id"]

    with open(FIXTURES / fixture_name, "rb") as f:
        resp = await c.post(
            "/api/datasets",
            params={"project_id": project_id},
            files={"file": (fixture_name, f, "text/csv")},
            headers=headers,
        )
    return resp.json(), headers


async def test_upload_automatically_creates_queued_analysis(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "auto1@example.com", "clean.csv")
        assert dataset["status"] == "ready"

        resp = await c.get(f"/api/datasets/{dataset['id']}/analysis", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "queued"
        assert body["progress"] == 0
        assert body["recommendations"] is None


async def test_full_pipeline_produces_validated_recommendations(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.analysis_orchestrator.get_ai_provider",
        lambda: FakeFindingsProvider(),
    )

    async with client as c:
        dataset, headers = await _signup_and_upload(c, "auto2@example.com", "clean.csv")

        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.claim_next_queued()
        assert analysis is not None
        assert analysis.dataset_id.hex == dataset["id"].replace("-", "")

        version = await DatasetVersionRepository(session).get(analysis.dataset_version_id)
        assert version is not None
        await run_analysis(session, analysis, version)

        resp = await c.get(f"/api/datasets/{dataset['id']}/analysis", headers=headers)
        body = resp.json()
        assert body["status"] == "ready", body
        assert body["progress"] == 100
        assert body["data_quality"]["score"] >= 0
        assert isinstance(body["data_quality"]["issues"], list)

        recs = body["recommendations"]
        assert len(recs["top"]) > 0
        assert len(recs["top"]) <= 8

        for rec in recs["top"]:
            assert rec["spec"]["chart_type"]
            assert rec["spec"]["encoding"]["x"] is not None
            assert 0.0 <= rec["confidence"] <= 1.0

        # no two recommendations should target the exact same field-set (redundancy filtering)
        all_recs = recs["top"] + recs["derived"]
        keys = {
            (
                r["spec"]["encoding"]["x"]["field"],
                (r["spec"]["encoding"]["y"] or {}).get("field"),
            )
            for r in all_recs
        }
        assert len(keys) == len(all_recs)


async def test_ai_failure_degrades_gracefully_not_a_hard_failure(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Gemini is advisory -- a provider failure should not break the whole analysis; the
    deterministic Story-derived recommendations must still be produced."""
    monkeypatch.setattr(
        "app.services.analysis_orchestrator.get_ai_provider",
        lambda: FakeFindingsProvider(fail=True),
    )

    async with client as c:
        dataset, _headers = await _signup_and_upload(c, "auto3@example.com", "clean.csv")

        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.claim_next_queued()
        assert analysis is not None
        version = await DatasetVersionRepository(session).get(analysis.dataset_version_id)
        await run_analysis(session, analysis, version)

    assert analysis.status == "ready"
    assert analysis.ai_findings.get("error") is not None
    assert len(analysis.recommendations["top"]) > 0


async def test_retry_requires_failed_status(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "auto4@example.com", "clean.csv")

        resp = await c.post(f"/api/datasets/{dataset['id']}/analysis/retry", headers=headers)
        assert resp.status_code == 409


async def test_failed_ingestion_never_creates_a_phantom_analysis(client: AsyncClient) -> None:
    """Analysis is only created after ingestion reaches READY (app/api/v1/datasets.py --
    upload_dataset returns early on ParseError, before AnalysisRepository.create() runs). A
    malformed upload must not leave behind a queued Analysis that can never actually process."""
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "auto5@example.com", "malformed.csv")
        assert dataset["status"] == "failed"

        resp = await c.get(f"/api/datasets/{dataset['id']}/analysis", headers=headers)
        assert resp.status_code == 404
