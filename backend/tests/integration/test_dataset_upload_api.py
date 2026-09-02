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


async def _signup_and_create_project(c: AsyncClient) -> tuple[str, str]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "curator@example.com",
            "password": "supersecret1",
            "organization_name": "Editorial Studio",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project = await c.post("/api/projects", json={"name": "Q1 Sales"}, headers=headers)
    return token, project.json()["id"]


async def test_upload_clean_csv(client: AsyncClient) -> None:
    async with client as c:
        _token, project_id = await _signup_and_create_project(c)
        headers = {"Authorization": f"Bearer {_token}"}

        with open(FIXTURES / "clean.csv", "rb") as f:
            resp = await c.post(
                "/api/datasets",
                params={"project_id": project_id},
                files={"file": ("clean.csv", f, "text/csv")},
                headers=headers,
            )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["original_filename"] == "clean.csv"
        assert body["size_bytes"] > 0
        assert body["status"] == "ready"

        listed = await c.get("/api/datasets", params={"project_id": project_id}, headers=headers)
        assert listed.status_code == 200
        assert len(listed.json()) == 1

        fetched = await c.get(f"/api/datasets/{body['id']}", headers=headers)
        assert fetched.status_code == 200

        deleted = await c.delete(f"/api/datasets/{body['id']}", headers=headers)
        assert deleted.status_code == 204


async def test_upload_rejects_malicious_extension(client: AsyncClient) -> None:
    async with client as c:
        _token, project_id = await _signup_and_create_project(c)
        headers = {"Authorization": f"Bearer {_token}"}

        resp = await c.post(
            "/api/datasets",
            params={"project_id": project_id},
            files={"file": ("evil.sh", b"#!/bin/sh\nrm -rf /", "application/x-sh")},
            headers=headers,
        )
        assert resp.status_code == 422
        assert "extension" in resp.json()["detail"].lower()


async def test_upload_rejects_mime_mismatch(client: AsyncClient) -> None:
    """A .csv extension wrapping a PNG's magic bytes must be rejected — never trust extension."""
    async with client as c:
        _token, project_id = await _signup_and_create_project(c)
        headers = {"Authorization": f"Bearer {_token}"}

        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        resp = await c.post(
            "/api/datasets",
            params={"project_id": project_id},
            files={"file": ("fake.csv", png_bytes, "text/csv")},
            headers=headers,
        )
        assert resp.status_code == 422
        assert "does not match" in resp.json()["detail"].lower()


async def test_upload_requires_project_ownership(client: AsyncClient) -> None:
    async with client as c:
        _token, _project_id = await _signup_and_create_project(c)
        headers = {"Authorization": f"Bearer {_token}"}

        resp = await c.post(
            "/api/datasets",
            params={"project_id": "00000000-0000-0000-0000-000000000000"},
            files={"file": ("clean.csv", b"a,b\n1,2\n", "text/csv")},
            headers=headers,
        )
        assert resp.status_code == 404
