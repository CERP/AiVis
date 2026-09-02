import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.dataset import Dataset, DatasetStatus, DatasetVersion
from app.models.project import Project
from app.models.user import MembershipRole, Organization, User
from app.repositories.dataset import DatasetRepository, DatasetVersionRepository
from app.repositories.organization import OrganizationRepository
from app.repositories.project import ProjectRepository
from app.repositories.user import UserRepository

pytestmark = pytest.mark.asyncio


async def test_user_repository_get_by_email(session: AsyncSession) -> None:
    repo = UserRepository(session)
    user = await repo.create(User(email="ada@example.com", hashed_password="x"))

    found = await repo.get_by_email("ada@example.com")
    assert found is not None
    assert found.id == user.id

    assert await repo.get_by_email("missing@example.com") is None


async def test_organization_repository_get_by_slug(session: AsyncSession) -> None:
    repo = OrganizationRepository(session)
    await repo.create(Organization(name="Acme", slug="acme"))

    found = await repo.get_by_slug("acme")
    assert found is not None
    assert found.name == "Acme"


async def test_project_repository_list_for_organization(session: AsyncSession) -> None:
    org_repo = OrganizationRepository(session)
    org = await org_repo.create(Organization(name="Acme", slug="acme-2"))

    project_repo = ProjectRepository(session)
    await project_repo.create(Project(organization_id=org.id, name="Q1 Report"))
    await project_repo.create(Project(organization_id=org.id, name="Q2 Report"))

    projects = await project_repo.list_for_organization(org.id)
    assert {p.name for p in projects} == {"Q1 Report", "Q2 Report"}


async def test_dataset_version_repository_get_latest(session: AsyncSession) -> None:
    org = await OrganizationRepository(session).create(Organization(name="Acme", slug="acme-3"))
    project = await ProjectRepository(session).create(
        Project(organization_id=org.id, name="P1")
    )
    dataset = await DatasetRepository(session).create(
        Dataset(
            project_id=project.id,
            name="sales.csv",
            original_filename="sales.csv",
            mime_type="text/csv",
            status=DatasetStatus.READY,
            raw_object_key="raw/sales.csv",
        )
    )

    version_repo = DatasetVersionRepository(session)
    await version_repo.create(
        DatasetVersion(
            dataset_id=dataset.id,
            version_number=0,
            parquet_object_key="v0.parquet",
            is_raw=True,
        )
    )
    v1 = await version_repo.create(
        DatasetVersion(
            dataset_id=dataset.id,
            version_number=1,
            parquet_object_key="v1.parquet",
            is_raw=False,
        )
    )

    latest = await version_repo.get_latest(dataset.id)
    assert latest is not None
    assert latest.id == v1.id

    all_versions = await version_repo.list_for_dataset(dataset.id)
    assert [v.version_number for v in all_versions] == [0, 1]


async def test_membership_role_enum_persists(session: AsyncSession) -> None:
    from app.models.user import Membership

    user = await UserRepository(session).create(User(email="bob@example.com", hashed_password="x"))
    org = await OrganizationRepository(session).create(Organization(name="Acme", slug="acme-4"))

    from app.repositories.organization import MembershipRepository

    membership_repo = MembershipRepository(session)
    await membership_repo.create(
        Membership(user_id=user.id, organization_id=org.id, role=MembershipRole.ADMIN)
    )

    memberships = await membership_repo.list_for_user(user.id)
    assert memberships[0].role == MembershipRole.ADMIN
