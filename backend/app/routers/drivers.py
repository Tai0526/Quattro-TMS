from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Driver, User
from app.schemas import DriverCreate, DriverUpdate, DriverOut
from app.core.deps import require_supervisor, require_manager, require_any
from app.middleware.audit import log_action

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("", response_model=List[DriverOut])
def list_drivers(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    q = db.query(Driver)
    if status:
        q = q.filter(Driver.status == status)
    if search:
        q = q.filter(
            Driver.full_name.ilike(f"%{search}%") |
            Driver.employee_no.ilike(f"%{search}%")
        )
    return q.order_by(Driver.full_name).all()


@router.post("", response_model=DriverOut, status_code=201)
def create_driver(
    payload: DriverCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    if db.query(Driver).filter(Driver.employee_no == payload.employee_no).first():
        raise HTTPException(status_code=400, detail="Employee number already exists")

    driver = Driver(**payload.model_dump(), created_by=current_user.id)
    db.add(driver)
    db.commit()
    db.refresh(driver)
    log_action(db, current_user.id, "CREATE", "driver", driver.id,
               new_value=payload.model_dump(mode="json"), ip_address=request.client.host)
    return driver


@router.get("/{driver_id}", response_model=DriverOut)
def get_driver(
    driver_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.patch("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: str,
    payload: DriverUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    old = {c.name: str(getattr(driver, c.name)) for c in driver.__table__.columns}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(driver, field, value)
    db.commit()
    db.refresh(driver)
    log_action(db, current_user.id, "UPDATE", "driver", driver.id,
               old_value=old, new_value=payload.model_dump(exclude_unset=True, mode="json"),
               ip_address=request.client.host)
    return driver


@router.delete("/{driver_id}", status_code=204)
def delete_driver(
    driver_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    old = {c.name: str(getattr(driver, c.name)) for c in driver.__table__.columns}
    db.delete(driver)
    db.commit()
    log_action(db, current_user.id, "DELETE", "driver", driver_id,
               old_value=old, ip_address=request.client.host)
