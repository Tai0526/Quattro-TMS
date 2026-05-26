from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import User, UserRole
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user, require_admin
from app.middleware.audit import log_action
from app.schemas import UserCreate, UserOut, UserUpdatePayload, LoginRequest, TokenResponse, RefreshRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    log_action(db, user.id, "LOGIN", "user", user.id, ip_address=request.client.host)

    return TokenResponse(
        access_token=create_access_token({"sub": user.id, "role": user.role}),
        refresh_token=create_refresh_token({"sub": user.id}),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == data.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return TokenResponse(
        access_token=create_access_token({"sub": user.id, "role": user.role}),
        refresh_token=create_refresh_token({"sub": user.id}),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Email already registered")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, current_user.id, "CREATE", "user", user.id,
               new_value={"email": user.email, "role": str(user.role)},
               ip_address=request.client.host)
    return user


@router.get("/users-list", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    request: Request,
    full_name: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    password: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user_id == current_user.id and is_active is False:
        raise HTTPException(400, "You cannot deactivate your own account")

    if full_name  is not None: user.full_name        = full_name
    if is_active  is not None: user.is_active        = is_active
    if password:               user.hashed_password  = hash_password(password)
    if role is not None:
        try:
            user.role = UserRole(role)
        except ValueError:
            raise HTTPException(400, f"Invalid role '{role}'")

    db.commit()
    db.refresh(user)
    log_action(db, current_user.id, "UPDATE", "user", user_id,
               new_value={"role": role, "is_active": is_active},
               ip_address=request.client.host)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    db.delete(user)
    db.commit()
    log_action(db, current_user.id, "DELETE", "user", user_id,
               ip_address=request.client.host)