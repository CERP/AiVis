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


async def _setup_visualization(c: AsyncClient) -> tuple[dict, str]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "export@example.com",
            "password": "supersecret1",
            "organization_name": "Export Co",
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
    profile = await c.get(f"/api/datasets/{dataset['id']}/profile", headers=headers)
    version_id = profile.json()["dataset_version_id"]

    viz_resp = await c.post(
        "/api/visualizations",
        params={"project_id": project_id},
        json={
            "title": "Revenue by region",
            "spec": {
                "chart_type": "bar",
                "encoding": {
                    "x": {"field": "region", "type": "nominal"},
                    "y": {"field": "revenue", "type": "quantitative", "aggregation": "sum"},
                },
                "metadata": {"dataset_id": dataset["id"], "dataset_version_id": version_id},
            },
        },
        headers=headers,
    )
    viz = viz_resp.json()
    return headers, viz["current_version_id"]


async def test_create_and_fetch_svg_export(client: AsyncClient) -> None:
    async with client as c:
        headers, version_id = await _setup_visualization(c)

        svg_bytes = b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"
        resp = await c.post(
            "/api/exports",
            params={"visualization_version_id": version_id, "format": "svg"},
            files={"file": ("visualization.svg", svg_bytes, "image/svg+xml")},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "ready"
        assert body["download_url"] is not None
        assert body["format"] == "svg"

        get_resp = await c.get(f"/api/exports/{body['id']}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["download_url"] is not None


async def test_create_png_export(client: AsyncClient) -> None:
    async with client as c:
        headers, version_id = await _setup_visualization(c)

        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
        resp = await c.post(
            "/api/exports",
            params={"visualization_version_id": version_id, "format": "png"},
            files={"file": ("visualization.png", png_bytes, "image/png")},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["format"] == "png"


async def test_export_rejects_empty_file(client: AsyncClient) -> None:
    async with client as c:
        headers, version_id = await _setup_visualization(c)

        resp = await c.post(
            "/api/exports",
            params={"visualization_version_id": version_id, "format": "svg"},
            files={"file": ("visualization.svg", b"", "image/svg+xml")},
            headers=headers,
        )
        assert resp.status_code == 422


async def test_export_rejects_pdf_format(client: AsyncClient) -> None:
    async with client as c:
        headers, version_id = await _setup_visualization(c)

        resp = await c.post(
            "/api/exports",
            params={"visualization_version_id": version_id, "format": "pdf"},
            files={"file": ("visualization.pdf", b"x", "application/pdf")},
            headers=headers,
        )
        assert resp.status_code == 422


async def test_export_requires_owned_version(client: AsyncClient) -> None:
    async with client as c:
        headers, _version_id = await _setup_visualization(c)

        resp = await c.post(
            "/api/exports",
            params={
                "visualization_version_id": "00000000-0000-0000-0000-000000000000",
                "format": "svg",
            },
            files={"file": ("visualization.svg", b"<svg></svg>", "image/svg+xml")},
            headers=headers,
        )
        assert resp.status_code == 404
