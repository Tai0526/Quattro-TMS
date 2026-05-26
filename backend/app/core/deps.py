from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_token
from app.models import User, UserRole

bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_roles(*roles: UserRole):
    def dep(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{current_user.role}' does not have permission for this action."
            )
        return current_user
    return dep

# Convenience guards — use these in your routers
require_admin    = require_roles(UserRole.admin)
require_manager  = require_roles(UserRole.admin, UserRole.operations_manager, UserRole.manager)
require_ops      = require_roles(UserRole.admin, UserRole.operations_manager)
def require_supervisor(current_user: User = Depends(get_current_user)) -> User:
    allowed = {
        UserRole.admin,
        UserRole.operations_manager,
        UserRole.manager,
        UserRole.supervisor,
        UserRole.safety,
        UserRole.tracker,
        UserRole.workshop,
    }
    if current_user.role not in allowed:
        raise HTTPException(status_code=403, detail=f"Role '{current_user.role}' does not have permission for this action.")
    return current_user
require_any      = require_roles(*list(UserRole))  # any authenticated user

# Module-specific guards
require_safety   = require_roles(UserRole.admin, UserRole.operations_manager, UserRole.manager, UserRole.safety, UserRole.supervisor)
require_workshop = require_roles(UserRole.admin, UserRole.operations_manager, UserRole.workshop, UserRole.supervisor)
require_tracker  = require_roles(UserRole.admin, UserRole.operations_manager, UserRole.tracker, UserRole.supervisor)
