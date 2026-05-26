from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models import (
    SpeedEvent, Incident, IncidentEscalation, User, UserRole,
    SpeedEventStatus, IncidentType, IncidentSeverity, IncidentStatus
)
from app.schemas import SpeedEventCreate, SpeedEventUpdate, SpeedEventOut, IncidentOut
from app.core.deps import require_supervisor, require_manager, require_any, require_tracker
from app.middleware.audit import log_action

router = APIRouter(prefix="/speed-events", tags=["speed-events"])


@router.get("", response_model=List[SpeedEventOut])
def list_speed_events(
    status: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    q = db.query(SpeedEvent)
    if status:    q = q.filter(SpeedEvent.status == status)
    if vehicle_id: q = q.filter(SpeedEvent.vehicle_id == vehicle_id)
    if driver_id:  q = q.filter(SpeedEvent.driver_id == driver_id)
    return q.order_by(SpeedEvent.event_datetime.desc()).all()


@router.post("", response_model=SpeedEventOut, status_code=201)
def create_speed_event(
    payload: SpeedEventCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tracker),
):
    event = SpeedEvent(**payload.model_dump(), logged_by=current_user.id)
    db.add(event)
    db.commit()
    db.refresh(event)
    log_action(db, current_user.id, "CREATE", "speed_event", event.id,
               new_value=payload.model_dump(mode="json"),
               ip_address=request.client.host)
    return event


@router.get("/{event_id}", response_model=SpeedEventOut)
def get_speed_event(
    event_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    event = db.query(SpeedEvent).filter(SpeedEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Speed event not found")
    return event


@router.patch("/{event_id}", response_model=SpeedEventOut)
def update_speed_event(
    event_id: str,
    payload: SpeedEventUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    event = db.query(SpeedEvent).filter(SpeedEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Speed event not found")

    old_status = event.status
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    log_action(db, current_user.id, "UPDATE", "speed_event", event.id,
               old_value={"status": str(old_status)},
               new_value=payload.model_dump(exclude_unset=True),
               ip_address=request.client.host)
    return event

@router.post("/{event_id}/escalate", response_model=IncidentOut, status_code=201)
def escalate_to_incident(
    event_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    event = db.query(SpeedEvent).filter(SpeedEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Speed event not found")
    if event.status != SpeedEventStatus.confirmed:
        raise HTTPException(
            400,
            "Only confirmed speed events can be escalated. "
            "Set status to confirmed and save first."
        )
    if event.incident_id:
        raise HTTPException(400, "This event has already been escalated")

    # Find a safety/supervisor user to assign the incident to
    safety_user = db.query(User).filter(
        User.role.in_([UserRole.safety, UserRole.supervisor]),
        User.is_active == True,
    ).first()

    incident = Incident(
        incident_type=IncidentType.speed,
        vehicle_id=event.vehicle_id,
        driver_id=event.driver_id,
        event_datetime=event.event_datetime,
        severity=IncidentSeverity.high,
        description=(
            f"Escalated from GPS speed event. "
            f"Vehicle recorded at {event.recorded_speed} km/h "
            f"in a {event.speed_limit} km/h zone. "
            f"Tracker: {event.tracker_source}. "
            f"Requires safety follow-up and incident report."
        ),
        location=event.location_description,
        status=IncidentStatus.draft,
        created_by=safety_user.id if safety_user else current_user.id,
        submitted_at=None,
    )
    db.add(incident)
    db.flush()

    event.incident_id = incident.id
    event.status      = SpeedEventStatus.closed

    db.add(IncidentEscalation(
        incident_id=incident.id,
        from_status=IncidentStatus.draft,
        to_status=IncidentStatus.draft,
        escalated_by=current_user.id,
        notes=(
            f"Incident created from GPS speed event by {current_user.full_name}. "
            f"Assigned to safety team for follow-up and report."
        ),
    ))

    db.commit()
    db.refresh(incident)
    log_action(db, current_user.id, "ESCALATE", "speed_event", event_id,
               new_value={"incident_id": incident.id},
               ip_address=request.client.host)
    return incident