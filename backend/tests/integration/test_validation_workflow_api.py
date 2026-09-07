from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.gemini_provider import GeminiProvider
from app.ai.schemas import (
    DatasetAnomaly,
    DatasetAuditReport,
    DatasetQualityStatus,
    DynamicTransformStep,
)
from app.core.db import get_session
from app.main import app
from app.models.dataset import DatasetVersion
from app.repositories.dataset import DatasetVersionRepository
from app.services.storage import get_storage_service

pytestmark = pytest.mark.asyncio
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.fixture
def client(session: AsyncSession) -> AsyncClient:
    async def override() -> AsyncSession:
        return session

    app.dependency_overrides[get_session] = override
    get_storage_service().ensure_buckets()
    try:
        yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    finally:
        app.dependency_overrides.clear()


async def _upload(client: AsyncClient) -> tuple[dict, dict]:
    signup = await client.post("/api/auth/signup", json={
        "email": "workflow_test@example.com",
        "password": "supersecret1",
        "organization_name": "Workflow Co",
    })
    headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
    project = await client.post("/api/projects", json={"name": "P"}, headers=headers)
    with open(FIXTURES / "messy.csv", "rb") as file:
        response = await client.post(
            "/api/datasets",
            params={"project_id": project.json()["id"]},
            files={"file": ("messy.csv", file, "text/csv")},
            headers=headers,
        )
    return response.json(), headers


def _audit() -> DatasetAuditReport:
    return DatasetAuditReport(
        dataset_status=DatasetQualityStatus.REQUIRES_CLEANING,
        data_quality_score_before=62,
        data_quality_score_after=82,
        anomalies=[DatasetAnomaly(
            column_name="region", row_index=1, value="South ", issue_type="whitespace",
            description="Trailing whitespace",
        )],
        cleaning_recipe=[DynamicTransformStep(
            column_name="region", action_type="trim_strings", reason="Remove trailing spaces",
        )],
        cleaning_summary=["Trimmed region labels."],
    )


async def test_audit_commit_versions_analysis_and_exports(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def generated(*args, **kwargs):
        return _audit()

    monkeypatch.setattr(GeminiProvider, "generate_structured", generated)
    async with client as api:
        dataset, headers = await _upload(api)
        original_versions = await DatasetVersionRepository(session).list_for_dataset(dataset["id"])
        original: DatasetVersion = original_versions[0]
        original_bytes = get_storage_service().download_bytes(
            get_storage_service().bucket_processed, original.parquet_object_key
        )

        audit_response = await api.get(
            f"/api/datasets/{dataset['id']}/validation-workflow", headers=headers
        )
        assert audit_response.status_code == 200, audit_response.text
        audit = audit_response.json()
        assert audit["dataset_status"] == "requires_cleaning"
        assert audit["changed_cells"] == 1
        assert audit["cleaned_version_id"] is None

        commit = await api.post(
            f"/api/datasets/{dataset['id']}/validation-workflow/apply",
            json={"audit_id": audit["audit_id"], "selection": "cleaned"},
            headers=headers,
        )
        assert commit.status_code == 200, commit.text
        assert commit.json()["version_number"] == 1
        assert commit.json()["cleaned_version_created"] is True

        versions = await DatasetVersionRepository(session).list_for_dataset(dataset["id"])
        assert len(versions) == 2
        assert versions[0].is_raw is True
        assert get_storage_service().download_bytes(
            get_storage_service().bucket_processed, versions[0].parquet_object_key
        ) == original_bytes

        analysis = await api.get(f"/api/datasets/{dataset['id']}/analysis", headers=headers)
        assert analysis.json()["dataset_version_id"] == commit.json()["dataset_version_id"]
        assert (await api.get(
            f"/api/datasets/{dataset['id']}/export/raw/csv", headers=headers
        )).status_code == 200
        assert (await api.get(
            f"/api/datasets/{dataset['id']}/export/cleaned/xlsx", headers=headers
        )).status_code == 200


async def test_validation_rejection_does_not_create_version(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    rejected = _audit().model_copy(update={
        "cleaning_recipe": [DynamicTransformStep(
            column_name="units", action_type="coerce_numeric", reason="Parse units",
        )]
    })

    async def generated(*args, **kwargs):
        return rejected

    monkeypatch.setattr(GeminiProvider, "generate_structured", generated)
    async with client as api:
        dataset, headers = await _upload(api)
        audit = (await api.get(
            f"/api/datasets/{dataset['id']}/validation-workflow", headers=headers
        )).json()
        assert audit["workflow_status"] == "validation_failed"
        response = await api.post(
            f"/api/datasets/{dataset['id']}/validation-workflow/apply",
            json={"audit_id": audit["audit_id"], "selection": "cleaned"},
            headers=headers,
        )
        assert response.status_code == 422
        assert len(await DatasetVersionRepository(session).list_for_dataset(dataset["id"])) == 1
