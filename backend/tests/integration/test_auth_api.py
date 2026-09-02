import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import get_session
from app.main import app

pytestmark = pytest.mark.asyncio


@pytest.fixture
def client(session: AsyncSession) -> AsyncClient:
    async def _get_session_override() -> AsyncSession:
        return session

    app.dependency_overrides[get_session] = _get_session_override
    try:
        transport = ASGITransport(app=app)
        yield AsyncClient(transport=transport, base_url="http://test")
    finally:
        app.dependency_overrides.clear()


async def test_signup_login_me_flow(client: AsyncClient) -> None:
    async with client as c:
        signup = await c.post(
            "/api/auth/signup",
            json={
                "email": "grace@example.com",
                "password": "supersecret1",
                "full_name": "Grace Hopper",
                "organization_name": "Compilers Inc",
            },
        )
        assert signup.status_code == 201
        token = signup.json()["access_token"]

        me = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "grace@example.com"

        no_token = await c.get("/api/auth/me")
        assert no_token.status_code == 401

        bad_login = await c.post(
            "/api/auth/login", json={"email": "grace@example.com", "password": "wrong"}
        )
        assert bad_login.status_code == 401

        good_login = await c.post(
            "/api/auth/login", json={"email": "grace@example.com", "password": "supersecret1"}
        )
        assert good_login.status_code == 200

        dup = await c.post(
            "/api/auth/signup",
            json={
                "email": "grace@example.com",
                "password": "supersecret1",
                "organization_name": "Other",
            },
        )
        assert dup.status_code == 409
