from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import Membership, MembershipRole, Organization, User
from app.repositories.organization import MembershipRepository, OrganizationRepository
from app.repositories.user import UserRepository
from app.schemas.auth import SignupRequest


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


async def signup(session: AsyncSession, payload: SignupRequest) -> tuple[User, str]:
    user_repo = UserRepository(session)
    if await user_repo.get_by_email(payload.email) is not None:
        raise EmailAlreadyRegisteredError(payload.email)

    user = await user_repo.create(
        User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
        )
    )

    org_repo = OrganizationRepository(session)
    slug_base = payload.organization_name.strip().lower().replace(" ", "-")
    slug = slug_base
    suffix = 1
    while await org_repo.get_by_slug(slug) is not None:
        suffix += 1
        slug = f"{slug_base}-{suffix}"
    organization = await org_repo.create(Organization(name=payload.organization_name, slug=slug))

    await MembershipRepository(session).create(
        Membership(user_id=user.id, organization_id=organization.id, role=MembershipRole.OWNER)
    )

    token = create_access_token(str(user.id))
    return user, token


async def login(session: AsyncSession, email: str, password: str) -> tuple[User, str]:
    user = await UserRepository(session).get_by_email(email)
    if user is None or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError()
    token = create_access_token(str(user.id))
    return user, token
