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
            "email": "cleaner@example.com",
            "password": "supersecret1",
            "organization_name": "Cleaning Co",
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


async def test_coerce_numeric_creates_new_version_and_reports_counts(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "messy.csv")
        assert dataset["status"] == "ready"

        resp = await c.post(
            f"/api/datasets/{dataset['id']}/clean",
            json={"operation_type": "coerce_numeric", "column_name": "units"},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["version_number"] == 1
        assert body["valid_count"] == 6
        assert body["invalid_count"] == 1

        profile = await c.get(f"/api/datasets/{dataset['id']}/profile", headers=headers)
        by_name = {col["name"]: col for col in profile.json()["columns"]}
        assert by_name["units"]["semantic_type"] == "numeric"


async def test_parse_dates_reports_valid_invalid(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "messy.csv")

        resp = await c.post(
            f"/api/datasets/{dataset['id']}/clean",
            json={"operation_type": "parse_dates", "column_name": "date"},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["valid_count"] == 6
        assert body["invalid_count"] == 0


async def test_dedupe_rows(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "messy.csv")

        resp = await c.post(
            f"/api/datasets/{dataset['id']}/clean",
            json={
                "operation_type": "dedupe_rows",
                "params": {"subset": ["date", "region", "product_name", "revenue", "units"]},
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["invalid_count"] == 1  # one row removed as duplicate
        assert body["row_count"] == 6


async def test_unknown_operation_returns_422(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "clean.csv")

        resp = await c.post(
            f"/api/datasets/{dataset['id']}/clean",
            json={"operation_type": "not_a_real_op"},
            headers=headers,
        )
        assert resp.status_code == 422


async def test_clean_requires_ready_dataset(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "malformed.csv")
        assert dataset["status"] == "failed"

        resp = await c.post(
            f"/api/datasets/{dataset['id']}/clean",
            json={"operation_type": "trim_strings", "column_name": "date"},
            headers=headers,
        )
        assert resp.status_code == 409
