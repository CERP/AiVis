from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.base import AIProvider, AIProviderError
from app.ai.schemas import StudioEditCommand, StudioEditCommandType
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


async def _setup(c: AsyncClient) -> tuple[str, str, str]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "viz@example.com",
            "password": "supersecret1",
            "organization_name": "Viz Co",
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

    return token, project_id, version_id


def _spec_payload(version_id: str) -> dict:
    return {
        "chart_type": "bar",
        "encoding": {
            "x": {"field": "region", "type": "nominal"},
            "y": {"field": "revenue", "type": "quantitative", "aggregation": "sum"},
        },
        "metadata": {"dataset_id": "ignored", "dataset_version_id": version_id},
    }


async def test_create_and_fetch_visualization(client: AsyncClient) -> None:
    async with client as c:
        token, project_id, version_id = await _setup(c)
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = await c.post(
            "/api/visualizations",
            params={"project_id": project_id},
            json={"title": "Revenue by region", "spec": _spec_payload(version_id)},
            headers=headers,
        )
        assert create_resp.status_code == 201, create_resp.text
        viz = create_resp.json()
        assert viz["current_version_id"] is not None

        get_resp = await c.get(f"/api/visualizations/{viz['id']}", headers=headers)
        assert get_resp.status_code == 200


async def test_create_rejects_unknown_field(client: AsyncClient) -> None:
    async with client as c:
        token, project_id, version_id = await _setup(c)
        headers = {"Authorization": f"Bearer {token}"}

        spec = _spec_payload(version_id)
        spec["encoding"]["x"]["field"] = "not_a_real_column"

        resp = await c.post(
            "/api/visualizations",
            params={"project_id": project_id},
            json={"title": "Bad viz", "spec": spec},
            headers=headers,
        )
        assert resp.status_code == 422


async def test_apply_command_creates_new_version(client: AsyncClient) -> None:
    async with client as c:
        token, project_id, version_id = await _setup(c)
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = await c.post(
            "/api/visualizations",
            params={"project_id": project_id},
            json={"title": "Revenue by region", "spec": _spec_payload(version_id)},
            headers=headers,
        )
        viz_id = create_resp.json()["id"]

        patch_resp = await c.patch(
            f"/api/visualizations/{viz_id}",
            json={"command": {"type": "change_chart_type", "params": {"chart_type": "line"}}},
            headers=headers,
        )
        assert patch_resp.status_code == 200, patch_resp.text
        new_version = patch_resp.json()
        assert new_version["version_number"] == 2
        assert new_version["spec"]["chart_type"] == "line"

        versions_resp = await c.get(f"/api/visualizations/{viz_id}/versions", headers=headers)
        assert versions_resp.status_code == 200
        versions = versions_resp.json()
        assert len(versions) == 2
        assert versions[0]["spec"]["chart_type"] == "bar"
        assert versions[1]["spec"]["chart_type"] == "line"


async def test_apply_command_rejects_invalid_field_change(client: AsyncClient) -> None:
    async with client as c:
        token, project_id, version_id = await _setup(c)
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = await c.post(
            "/api/visualizations",
            params={"project_id": project_id},
            json={"title": "Revenue by region", "spec": _spec_payload(version_id)},
            headers=headers,
        )
        viz_id = create_resp.json()["id"]

        patch_resp = await c.patch(
            f"/api/visualizations/{viz_id}",
            json={
                "command": {
                    "type": "change_field",
                    "params": {
                        "channel": "x",
                        "field": "not_a_column",
                        "encoding_type": "nominal",
                    },
                }
            },
            headers=headers,
        )
        assert patch_resp.status_code == 422

        # rejected command must not have created a new version
        versions_resp = await c.get(f"/api/visualizations/{viz_id}/versions", headers=headers)
        assert len(versions_resp.json()) == 1


class FakeStudioEditProvider(AIProvider):
    def __init__(self, response: StudioEditCommand | None = None, fail: bool = False):
        self._response = response
        self._fail = fail

    async def generate_structured(self, *, system_instruction, prompt, response_schema):
        if self._fail:
            raise AIProviderError("simulated Gemini failure")
        assert self._response is not None
        return self._response


async def test_nl_edit_applies_translated_command(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.v1.visualizations.get_ai_provider",
        lambda: FakeStudioEditProvider(
            response=StudioEditCommand(
                command_type=StudioEditCommandType.CHANGE_AGGREGATION,
                channel="y",
                aggregation="median",
                explanation="Switched the y-axis aggregation to median.",
            )
        ),
    )

    async with client as c:
        token, project_id, version_id = await _setup(c)
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = await c.post(
            "/api/visualizations",
            params={"project_id": project_id},
            json={"title": "Revenue by region", "spec": _spec_payload(version_id)},
            headers=headers,
        )
        viz_id = create_resp.json()["id"]

        nl_resp = await c.post(
            f"/api/visualizations/{viz_id}/nl-edit",
            json={"query": "change y-axis aggregation to median"},
            headers=headers,
        )
        assert nl_resp.status_code == 200, nl_resp.text
        new_version = nl_resp.json()
        assert new_version["version_number"] == 2
        assert new_version["spec"]["encoding"]["y"]["aggregation"] == "median"
        assert new_version["change_summary"] == "Switched the y-axis aggregation to median."
        assert new_version["created_by"] == "ai"


async def test_nl_edit_provider_failure_returns_502(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.v1.visualizations.get_ai_provider",
        lambda: FakeStudioEditProvider(fail=True),
    )

    async with client as c:
        token, project_id, version_id = await _setup(c)
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = await c.post(
            "/api/visualizations",
            params={"project_id": project_id},
            json={"title": "Revenue by region", "spec": _spec_payload(version_id)},
            headers=headers,
        )
        viz_id = create_resp.json()["id"]

        nl_resp = await c.post(
            f"/api/visualizations/{viz_id}/nl-edit",
            json={"query": "do something"},
            headers=headers,
        )
        assert nl_resp.status_code == 502

        versions_resp = await c.get(f"/api/visualizations/{viz_id}/versions", headers=headers)
        assert len(versions_resp.json()) == 1


async def test_nl_edit_hallucinated_field_rejected(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.v1.visualizations.get_ai_provider",
        lambda: FakeStudioEditProvider(
            response=StudioEditCommand(
                command_type=StudioEditCommandType.CHANGE_FIELD,
                channel="x",
                field="not_a_real_column",
                encoding_type="nominal",
                explanation="x",
            )
        ),
    )

    async with client as c:
        token, project_id, version_id = await _setup(c)
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = await c.post(
            "/api/visualizations",
            params={"project_id": project_id},
            json={"title": "Revenue by region", "spec": _spec_payload(version_id)},
            headers=headers,
        )
        viz_id = create_resp.json()["id"]

        nl_resp = await c.post(
            f"/api/visualizations/{viz_id}/nl-edit",
            json={"query": "put nonsense on the x axis"},
            headers=headers,
        )
        assert nl_resp.status_code == 422

        versions_resp = await c.get(f"/api/visualizations/{viz_id}/versions", headers=headers)
        assert len(versions_resp.json()) == 1
