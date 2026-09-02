import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import get_session
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.organization import MembershipRepository
from app.repositories.user import UserRepository

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise unauthorized

    try:
        user_id = uuid.UUID(subject)
    except ValueError:
        raise unauthorized from None

    user = await UserRepository(session).get(user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


async def get_current_organization_id(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> uuid.UUID:
    """Returns the user's first organization. Org switching (multi-org UI) is future work —
    every user gets exactly one owner-role organization at signup for now."""
    memberships = await MembershipRepository(session).list_for_user(current_user.id)
    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User has no organization"
        )
    return memberships[0].organization_id
