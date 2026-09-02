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


async def _signup_and_upload(c: AsyncClient, fixture_name: str) -> tuple[dict, dict]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "stories@example.com",
            "password": "supersecret1",
            "organization_name": "Stories Co",
        },
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


async def test_stories_require_insights_first(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "clean.csv")

        resp = await c.post(f"/api/datasets/{dataset['id']}/stories/analyze", headers=headers)
        assert resp.status_code == 409


async def test_stories_derive_from_insights(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "clean.csv")

        insights_resp = await c.post(
            f"/api/datasets/{dataset['id']}/insights/analyze", headers=headers
        )
        insights = insights_resp.json()

        stories_resp = await c.post(
            f"/api/datasets/{dataset['id']}/stories/analyze", headers=headers
        )
        assert stories_resp.status_code == 201, stories_resp.text
        stories = stories_resp.json()

        assert len(stories) == len(insights)
        for story in stories:
            assert story["analytical_question"].endswith("?")
            assert story["recommended_chart_type"] is not None
            assert story["insight_id"] is not None

        trend_story = next(s for s in stories if s["recommended_chart_type"] == "line")
        assert "change over time" in trend_story["analytical_question"].lower()

        listed = await c.get(f"/api/datasets/{dataset['id']}/stories", headers=headers)
        assert listed.status_code == 200
        assert len(listed.json()) == len(stories)
