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


async def test_list_projects_reports_real_dataset_count(client: AsyncClient) -> None:
    async with client as c:
        signup = await c.post(
            "/api/auth/signup",
            json={
                "email": "proj-count@example.com",
                "password": "supersecret1",
                "organization_name": "Proj Co",
            },
        )
        headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}

        create_resp = await c.post("/api/projects", json={"name": "P"}, headers=headers)
        project = create_resp.json()
        assert project["dataset_count"] == 0
        assert "updated_at" in project

        with open(FIXTURES / "clean.csv", "rb") as f:
            await c.post(
                "/api/datasets",
                params={"project_id": project["id"]},
                files={"file": ("clean.csv", f, "text/csv")},
                headers=headers,
            )

        list_resp = await c.get("/api/projects", headers=headers)
        assert list_resp.status_code == 200
        listed = next(p for p in list_resp.json() if p["id"] == project["id"])
        assert listed["dataset_count"] == 1

        get_resp = await c.get(f"/api/projects/{project['id']}", headers=headers)
        assert get_resp.json()["dataset_count"] == 1


async def test_delete_project_cascades(client: AsyncClient) -> None:
    async with client as c:
        signup = await c.post(
            "/api/auth/signup",
            json={
                "email": "proj-del@example.com",
                "password": "supersecret1",
                "organization_name": "Del Co",
            },
        )
        headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}

        # Create project
        create_resp = await c.post("/api/projects", json={"name": "Project to Delete"}, headers=headers)
        project = create_resp.json()

        # Upload dataset
        with open(FIXTURES / "clean.csv", "rb") as f:
            await c.post(
                "/api/datasets",
                params={"project_id": project["id"]},
                files={"file": ("clean.csv", f, "text/csv")},
                headers=headers,
            )

        # Confirm dataset exists
        dataset_list = await c.get("/api/datasets", params={"project_id": project["id"]}, headers=headers)
        assert len(dataset_list.json()) == 1

        # Delete project
        del_resp = await c.delete(f"/api/projects/{project['id']}", headers=headers)
        assert del_resp.status_code == 204

        # Verify project is deleted
        get_resp = await c.get(f"/api/projects/{project['id']}", headers=headers)
        assert get_resp.status_code == 404

        # Verify datasets of deleted project are deleted or returning 404
        dataset_list_after = await c.get("/api/datasets", params={"project_id": project["id"]}, headers=headers)
        assert dataset_list_after.status_code == 404
