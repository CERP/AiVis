from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from app.services.auth import EmailAlreadyRegisteredError, InvalidCredentialsError, login, signup

router = APIRouter(prefix="/auth", tags=["auth"])


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
