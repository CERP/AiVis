from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.api.v1.auth import update_profile_route
from app.models.user import User
from app.schemas.auth import UpdateProfileRequest
from app.schemas.auth import ChangePasswordRequest
from app.api.v1.auth import change_password_route
from app.core.security import hash_password, verify_password
from fastapi import HTTPException


@pytest.mark.parametrize("password", ["short", "é" * 40])
def test_reject_invalid_new_password(password):
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="old-password", new_password=password)


@pytest.mark.asyncio
async def test_password_change_verifies_old_and_persists_hash():
    user = User(email="test@example.com", hashed_password=hash_password("old-password"))
    session = MagicMock()
    session.commit = AsyncMock()
    for current, new in [("wrong-password", "new-password"), ("old-password", "old-password")]:
        with pytest.raises(HTTPException):
            await change_password_route(ChangePasswordRequest(current_password=current, new_password=new), user, session)
        session.commit.assert_not_awaited()
    await change_password_route(ChangePasswordRequest(current_password="old-password", new_password="new-password"), user, session)
    assert verify_password("new-password", user.hashed_password)
    assert not verify_password("old-password", user.hashed_password)
    session.commit.assert_awaited_once()


@pytest.mark.parametrize("name", ["", "   ", "x" * 201])
def test_reject_invalid_profile_name(name):
    with pytest.raises(ValidationError):
        UpdateProfileRequest(full_name=name)


@pytest.mark.asyncio
async def test_profile_update_preserves_email_and_commits():
    user = User(email="test@example.com", full_name="Before", hashed_password="unchanged")
    session = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    result = await update_profile_route(UpdateProfileRequest(full_name="  After  "), user, session)
    assert result.full_name == "After"
    assert result.email == "test@example.com"
    session.add.assert_called_once_with(user)
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(user)
