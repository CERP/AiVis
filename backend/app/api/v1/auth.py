from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from app.schemas.auth import UpdateProfileRequest
from app.schemas.auth import ChangePasswordRequest
from app.core.security import hash_password, verify_password
from starlette.concurrency import run_in_threadpool
from app.services.auth import EmailAlreadyRegisteredError, InvalidCredentialsError, login, signup

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password_route(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    if not await run_in_threadpool(verify_password, payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if await run_in_threadpool(verify_password, payload.new_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Choose a different new password")
    current_user.hashed_password = await run_in_threadpool(hash_password, payload.new_password)
    session.add(current_user)
    await session.commit()

@router.patch("/me", response_model=UserResponse)
async def update_profile_route(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    current_user.full_name = payload.full_name.strip()
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup_route(
    payload: SignupRequest, session: AsyncSession = Depends(get_session)
) -> TokenResponse:
    try:
        _, token = await signup(session, payload)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        ) from exc
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login_route(
    payload: LoginRequest, session: AsyncSession = Depends(get_session)
) -> TokenResponse:
    try:
        _, token = await login(session, payload.email, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        ) from exc
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me_route(current_user: User = Depends(get_current_user)) -> User:
    return current_user
