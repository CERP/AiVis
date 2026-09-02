from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import get_session
from app.main import app
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


async def _full_pipeline(c: AsyncClient) -> tuple[dict, dict]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "recs@example.com",
            "password": "supersecret1",
            "organization_name": "Recs Co",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project = await c.post("/api/projects", json={"name": "P"}, headers=headers)
    project_id = project.json()["id"]

    with open(FIXTURES / "clean.csv", "rb") as f:
        dataset_resp = await c.post(
            "/api/datasets",
            params={"project_id": project_id},
            files={"file": ("clean.csv", f, "text/csv")},
            headers=headers,
        )
    dataset = dataset_resp.json()

    await c.post(f"/api/datasets/{dataset['id']}/insights/analyze", headers=headers)
    await c.post(f"/api/datasets/{dataset['id']}/stories/analyze", headers=headers)

    return dataset, headers


async def test_recommendations_require_stories_first(client: AsyncClient) -> None:
    async with client as c:
        signup = await c.post(
            "/api/auth/signup",
            json={
                "email": "norecs@example.com",
                "password": "supersecret1",
                "organization_name": "NoRecs Co",
            },
        )
        headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
        project = await c.post("/api/projects", json={"name": "P"}, headers=headers)
        with open(FIXTURES / "clean.csv", "rb") as f:
            dataset_resp = await c.post(
                "/api/datasets",
                params={"project_id": project.json()["id"]},
                files={"file": ("clean.csv", f, "text/csv")},
                headers=headers,
            )
        dataset_id = dataset_resp.json()["id"]

        resp = await c.get(
            f"/api/datasets/{dataset_id}/visualizations/recommendations", headers=headers
        )
        assert resp.status_code == 409


async def test_recommendations_are_valid_specs_grounded_in_stories(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _full_pipeline(c)

        resp = await c.get(
            f"/api/datasets/{dataset['id']}/visualizations/recommendations", headers=headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert len(body["top"]) > 0
        assert len(body["top"]) <= 8

        for rec in body["top"]:
            assert rec["spec"]["chart_type"]
            assert rec["spec"]["encoding"]["x"] is not None
            assert rec["story_id"]
            assert 0.0 <= rec["confidence"] <= 1.0

        # confidence should be descending (ranked)
        confidences = [r["confidence"] for r in body["top"]]
        assert confidences == sorted(confidences, reverse=True)

        # no two recommendations should target the exact same chart_type + field pair
        all_recs = body["top"] + body["derived"]
        keys = {
            (
                r["spec"]["chart_type"],
                r["spec"]["encoding"]["x"]["field"],
                (r["spec"]["encoding"]["y"] or {}).get("field"),
            )
            for r in all_recs
        }
        assert len(keys) == len(all_recs)
