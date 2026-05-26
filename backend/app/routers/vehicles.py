from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Vehicle, User
from app.schemas import VehicleCreate, VehicleUpdate, VehicleOut
from app.core.deps import get_current_user, require_manager, require_supervisor, require_any, require_workshop
from app.middleware.audit import log_action

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=List[VehicleOut])
def list_vehicles(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    q = db.query(Vehicle)
    if status:
        q = q.filter(Vehicle.status == status)
    if search:
        q = q.filter(Vehicle.reg_plate.ilike(f"%{search}%"))
    return q.order_by(Vehicle.reg_plate).all()


@router.post("", response_model=VehicleOut, status_code=201)
def create_vehicle(
    payload: VehicleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workshop),
):
    if db.query(Vehicle).filter(Vehicle.reg_plate == payload.reg_plate).first():
        raise HTTPException(status_code=400, detail="Registration plate already exists")

    vehicle = Vehicle(**payload.model_dump(), created_by=current_user.id)
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    log_action(db, current_user.id, "CREATE", "vehicle", vehicle.id,
               new_value=payload.model_dump(), ip_address=request.client.host)
    return vehicle


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: str,
    payload: VehicleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    old = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    log_action(db, current_user.id, "UPDATE", "vehicle", vehicle.id,
               old_value=old, new_value=payload.model_dump(exclude_unset=True),
               ip_address=request.client.host)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    old = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
    db.delete(vehicle)
    db.commit()
    log_action(db, current_user.id, "DELETE", "vehicle", vehicle_id,
               old_value=old, ip_address=request.client.host)
