from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from fastapi.responses import StreamingResponse
import io
import base64
from fastapi.responses import Response

from app.database import get_db
from app.models import (
    Incident, IncidentEscalation, SpeedEvent, Document, User,
    IncidentType, IncidentSeverity, IncidentStatus, SpeedEventStatus,
    UserRole, DocumentCategory
)
from app.schemas import IncidentCreate, IncidentUpdate, IncidentOut
from app.core.deps import (
    require_supervisor, require_manager, require_any, get_current_user,
    require_roles
)
from app.middleware.audit import log_action
from app.config import settings

try:
    import boto3
    from botocore.config import Config
    def get_r2():
        return boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    R2_AVAILABLE = True
except Exception:
    R2_AVAILABLE = False

router = APIRouter(prefix="/incidents", tags=["incidents"])

require_ops = require_roles(UserRole.admin, UserRole.operations_manager)
require_manager_or_above = require_roles(
    UserRole.admin, UserRole.operations_manager, UserRole.manager
)


def _notify_upper_management(incident: Incident, step: str, db: Session):
    upper_mgmt = db.query(User).filter(
        User.role.in_([UserRole.upper_management, UserRole.admin]),
        User.is_active == True,
    ).all()
    for user in upper_mgmt:
        print(f"[NOTIFY] {user.email} — Incident {incident.id[:8]} → {step}")


def _get_user_display(user_id: Optional[str], db: Session) -> Optional[dict]:
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    return {"id": user.id, "full_name": user.full_name, "role": str(user.role)}


# ── List ──────────────────────────────────────────────────────────────

# ── Update list_incidents to include rejected for safety ──────────────
@router.get("", response_model=List[IncidentOut])
def list_incidents(
    status: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    q = db.query(Incident)
    role = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role)

    if role in ('safety', 'supervisor', 'tracker', 'workshop', 'viewer'):
        q = q.filter(Incident.created_by == current_user.id)

    if status:     q = q.filter(Incident.status == status)
    if vehicle_id: q = q.filter(Incident.vehicle_id == vehicle_id)
    if severity:   q = q.filter(Incident.severity == severity)

    return q.order_by(Incident.event_datetime.desc()).all()


# ── Allow edit on draft OR rejected ──────────────────────────────────
@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    if inc.status not in (IncidentStatus.draft, IncidentStatus.rejected):
        raise HTTPException(400, "Can only edit draft or rejected incidents")

    role = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role)
    if inc.created_by != current_user.id and role != 'admin':
        raise HTTPException(403, "You can only edit your own incidents")

    old_values = {k: str(getattr(inc, k, '')) for k in payload.model_dump(exclude_unset=True)}

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inc, field, value)

    # If it was rejected and they're editing, log the update
    if inc.status == IncidentStatus.rejected:
        inc.status = IncidentStatus.draft
        inc.rejection_reason = None
        db.add(IncidentEscalation(
            incident_id=inc.id,
            from_status=IncidentStatus.rejected,
            to_status=IncidentStatus.draft,
            escalated_by=current_user.id,
            notes=f"Incident updated by {current_user.full_name} following rejection. Returned to draft.",
        ))

    db.commit()
    db.refresh(inc)
    log_action(db, current_user.id, "UPDATE", "incident", incident_id,
               old_value=old_values,
               new_value=payload.model_dump(exclude_unset=True),
               ip_address=request.client.host)
    return inc


# ── Delete draft ──────────────────────────────────────────────────────
@router.delete("/{incident_id}", status_code=204)
def delete_incident(
    incident_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    if inc.status != IncidentStatus.draft:
        raise HTTPException(400, "Only draft incidents can be deleted")

    role = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role)
    if inc.created_by != current_user.id and role != 'admin':
        raise HTTPException(403, "You can only delete your own draft incidents")

    db.delete(inc)
    db.commit()
    log_action(db, current_user.id, "DELETE", "incident", incident_id,
               ip_address=request.client.host)


# ── Document download / view ──────────────────────────────────────────
@router.get("/{incident_id}/documents/{document_id}/download")
def download_document(
    incident_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.entity_id == incident_id,
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    content_type = doc.mime_type or 'application/octet-stream'

    # Local storage — content encoded in file_key
    if doc.file_key and doc.file_key.startswith('local::'):
        try:
            b64 = doc.file_key[len('local::'):]
            file_data = base64.b64decode(b64)
            return Response(
                content=file_data,
                media_type=content_type,
                headers={
                    'Content-Disposition': f'inline; filename="{doc.file_name}"',
                    'Content-Length': str(len(file_data)),
                }
            )
        except Exception as e:
            raise HTTPException(500, f"Could not read file: {e}")

    # R2 storage — stream through backend
    if R2_AVAILABLE and hasattr(settings, 'R2_ACCOUNT_ID') and settings.R2_ACCOUNT_ID:
        try:
            r2_response = get_r2().get_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=doc.file_key,
            )
            file_data = r2_response['Body'].read()
            return Response(
                content=file_data,
                media_type=content_type,
                headers={
                    'Content-Disposition': f'inline; filename="{doc.file_name}"',
                    'Content-Length': str(len(file_data)),
                }
            )
        except Exception as e:
            raise HTTPException(500, f"R2 retrieval failed: {e}")

    raise HTTPException(503, "File could not be retrieved — no storage backend available")

@router.post("", response_model=IncidentOut, status_code=201)
def create_incident(
    payload: IncidentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    incident = Incident(
        **payload.model_dump(),
        created_by=current_user.id,
        status=IncidentStatus.draft,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    log_action(db, current_user.id, "CREATE", "incident", incident.id,
               new_value=payload.model_dump(mode="json"),
               ip_address=request.client.host)
    return incident


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    return inc


@router.get("/{incident_id}/escalation-log")
def escalation_log(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    entries = db.query(IncidentEscalation).filter(
        IncidentEscalation.incident_id == incident_id
    ).order_by(IncidentEscalation.escalated_at).all()

    result = []
    for e in entries:
        user = db.query(User).filter(User.id == e.escalated_by).first()
        result.append({
            "id": e.id,
            "from_status": str(e.from_status),
            "to_status": str(e.to_status),
            "notes": e.notes,
            "escalated_at": e.escalated_at.isoformat() if e.escalated_at else None,
            "escalated_by_id": e.escalated_by,
            "escalated_by_name": user.full_name if user else "Unknown",
            "escalated_by_role": str(user.role.value if hasattr(user.role, 'value') else user.role) if user else None,
        })
    return result


@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    if inc.status not in (IncidentStatus.draft,):
        raise HTTPException(400, "Can only edit draft incidents")
    if inc.created_by != current_user.id:
        role = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role)
        if role not in ('admin',):
            raise HTTPException(403, "You can only edit your own incidents")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inc, field, value)
    db.commit()
    db.refresh(inc)
    log_action(db, current_user.id, "UPDATE", "incident", incident_id,
               new_value=payload.model_dump(exclude_unset=True),
               ip_address=request.client.host)
    return inc


# ── Evidence ──────────────────────────────────────────────────────────

@router.get("/{incident_id}/documents")
def get_incident_documents(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    return db.query(Document).filter(
        Document.entity_type == 'incident',
        Document.entity_id == incident_id,
        Document.superseded_by == None,
    ).order_by(Document.uploaded_at.desc()).all()


@router.post("/{incident_id}/evidence", status_code=201)
async def upload_evidence(
    incident_id: str,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    if inc.status == IncidentStatus.closed:
        raise HTTPException(400, "Cannot add evidence to a closed incident")

    content  = await file.read()

    # Store file content as base64 in the file_key field
    # This works without R2 — swap for R2 upload later
    b64_content = base64.b64encode(content).decode('utf-8')
    file_key = f"local::{b64_content}"

    doc = Document(
        entity_type='incident',
        entity_id=incident_id,
        category=DocumentCategory.other,
        file_key=file_key,
        file_name=file.filename,
        file_size=len(content),
        mime_type=file.content_type,
        notes=notes,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_action(
        db, current_user.id, "UPLOAD_EVIDENCE", "incident", incident_id,
        new_value={"file_name": file.filename, "file_size": len(content)},
        ip_address=request.client.host if request else None,
    )
    return doc

# ── Escalation ────────────────────────────────────────────────────────

@router.post("/{incident_id}/submit", response_model=IncidentOut)
def submit_incident(
    incident_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    if inc.status != IncidentStatus.draft:
        raise HTTPException(400, f"Incident is already {inc.status}, not draft")

    # Must have at least one document before submitting
    evidence = db.query(Document).filter(
        Document.entity_type == 'incident',
        Document.entity_id == incident_id,
        Document.superseded_by == None,
    ).first()
    if not evidence:
        raise HTTPException(
            400,
            "At least one supporting document must be attached before submitting."
        )

    old_status       = inc.status
    inc.status       = IncidentStatus.submitted
    inc.submitted_at = datetime.now(timezone.utc)

    db.add(IncidentEscalation(
        incident_id=inc.id,
        from_status=old_status,
        to_status=IncidentStatus.submitted,
        escalated_by=current_user.id,
        notes=f"Submitted for manager review by {current_user.full_name}",
    ))
    db.commit()
    db.refresh(inc)
    _notify_upper_management(inc, "submitted", db)
    log_action(db, current_user.id, "SUBMIT", "incident", incident_id,
               ip_address=request.client.host)
    return inc


@router.post("/{incident_id}/manager-review", response_model=IncidentOut)
def manager_review(
    incident_id: str,
    notes: str,
    approve: bool = True,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    if inc.status != IncidentStatus.submitted:
        raise HTTPException(400, "Incident must be in submitted status")
    if not notes or not notes.strip():
        raise HTTPException(400, "Review notes are required")

    old_status = inc.status

    if approve:
        inc.status              = IncidentStatus.ops_review
        inc.manager_reviewed_at = datetime.now(timezone.utc)
        inc.manager_reviewed_by = current_user.id
        to_status               = IncidentStatus.ops_review
        note_text = f"Approved by {current_user.full_name} (Manager): {notes}"
    else:
        inc.status           = IncidentStatus.rejected
        inc.rejection_reason = notes
        to_status            = IncidentStatus.rejected
        note_text = f"Rejected by {current_user.full_name} (Manager): {notes}"

    db.add(IncidentEscalation(
        incident_id=inc.id,
        from_status=old_status,
        to_status=to_status,
        escalated_by=current_user.id,
        notes=note_text,
    ))
    db.commit()
    db.refresh(inc)
    _notify_upper_management(inc, f"manager {'approved' if approve else 'rejected'}", db)
    return inc


@router.post("/{incident_id}/ops-close", response_model=IncidentOut)
def ops_close(
    incident_id: str,
    outcome: str,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ops),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    if inc.status != IncidentStatus.ops_review:
        raise HTTPException(400, "Incident must be in ops_review status")
    if not outcome or not outcome.strip():
        raise HTTPException(400, "Outcome notes are required")

    # Require evidence
    evidence = db.query(Document).filter(
        Document.entity_type == 'incident',
        Document.entity_id == incident_id,
        Document.superseded_by == None,
    ).first()
    if not evidence:
        raise HTTPException(
            400,
            "Evidence must be uploaded before this incident can be closed."
        )

    old_status          = inc.status
    inc.status          = IncidentStatus.closed
    inc.outcome         = outcome
    inc.ops_reviewed_at = datetime.now(timezone.utc)
    inc.ops_reviewed_by = current_user.id
    inc.closed_at       = datetime.now(timezone.utc)

    db.add(IncidentEscalation(
        incident_id=inc.id,
        from_status=old_status,
        to_status=IncidentStatus.closed,
        escalated_by=current_user.id,
        notes=f"Closed by {current_user.full_name} (Ops Manager): {outcome}",
    ))
    db.commit()
    db.refresh(inc)
    _notify_upper_management(inc, "closed by operations manager", db)
    log_action(db, current_user.id, "CLOSE", "incident", incident_id,
               ip_address=request.client.host if request else None)
    return inc


@router.post("/{incident_id}/escalate-from-speed", response_model=IncidentOut, status_code=201)
def escalate_from_speed(
    incident_id: str,
    event_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    event = db.query(SpeedEvent).filter(SpeedEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Speed event not found")
    if event.status != SpeedEventStatus.confirmed:
        raise HTTPException(400, "Speed event must be confirmed before escalation")
    if event.incident_id:
        raise HTTPException(400, "Already escalated")

    incident = Incident(
        incident_type=IncidentType.speed,
        vehicle_id=event.vehicle_id,
        driver_id=event.driver_id,
        event_datetime=event.event_datetime,
        severity=IncidentSeverity.high,
        description=(
            f"Escalated from speed event. "
            f"{event.recorded_speed} km/h in a {event.speed_limit} km/h zone. "
            f"Tracker: {event.tracker_source}."
        ),
        location=event.location_description,
        status=IncidentStatus.submitted,
        created_by=current_user.id,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(incident)
    db.flush()

    event.incident_id = incident.id
    event.status      = SpeedEventStatus.closed

    db.commit()
    db.refresh(incident)
    _notify_upper_management(incident, "created from speed event", db)
    return incident