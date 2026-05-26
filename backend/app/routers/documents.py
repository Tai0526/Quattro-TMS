from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Incident, Document, User, DocumentCategory
from app.schemas import IncidentCreate, IncidentUpdate, IncidentOut, DocumentOut
from app.core.deps import require_supervisor, require_manager, require_any
from app.middleware.audit import log_action
import boto3
from botocore.config import Config
from app.config import settings
import uuid

# ── Incidents ─────────────────────────────────────────────────────────
incident_router = APIRouter(prefix="/incidents", tags=["incidents"])


@incident_router.get("", response_model=List[IncidentOut])
def list_incidents(
    status: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    q = db.query(Incident)
    if status:
        q = q.filter(Incident.status == status)
    if vehicle_id:
        q = q.filter(Incident.vehicle_id == vehicle_id)
    return q.order_by(Incident.event_datetime.desc()).all()


@incident_router.post("", response_model=IncidentOut, status_code=201)
def create_incident(
    payload: IncidentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    incident = Incident(**payload.model_dump(), created_by=current_user.id)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    log_action(db, current_user.id, "CREATE", "incident", incident.id,
               new_value=payload.model_dump(mode="json"), ip_address=request.client.host)
    return incident


@incident_router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(incident, field, value)
    db.commit()
    db.refresh(incident)
    log_action(db, current_user.id, "UPDATE", "incident", incident_id,
               new_value=payload.model_dump(exclude_unset=True), ip_address=request.client.host)
    return incident


# ── Documents ─────────────────────────────────────────────────────────
document_router = APIRouter(prefix="/documents", tags=["documents"])


def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


@document_router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    category: DocumentCategory = Form(...),
    expiry_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 10 MB.")

    # Check for existing version
    existing = db.query(Document).filter(
        Document.entity_type == entity_type,
        Document.entity_id == entity_id,
        Document.category == category,
        Document.superseded_by == None,
    ).first()
    new_version = (existing.version + 1) if existing else 1

    # Upload to R2
    file_key = f"{entity_type}/{entity_id}/{category}/{uuid.uuid4()}_{file.filename}"
    content = await file.read()
    r2 = get_r2_client()
    r2.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=file_key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )

    from datetime import datetime
    expiry = datetime.fromisoformat(expiry_date) if expiry_date else None

    doc = Document(
        entity_type=entity_type,
        entity_id=entity_id,
        category=category,
        file_key=file_key,
        file_name=file.filename,
        file_size=len(content),
        mime_type=file.content_type,
        version=new_version,
        expiry_date=expiry,
        notes=notes,
        uploaded_by=current_user.id,
    )
    db.add(doc)

    if existing:
        existing.superseded_by = doc.id

    db.commit()
    db.refresh(doc)
    log_action(db, current_user.id, "CREATE", "document", doc.id,
               new_value={"entity_type": entity_type, "entity_id": entity_id,
                          "category": str(category), "version": new_version},
               ip_address=request.client.host if request else None)
    return doc


@document_router.get("", response_model=List[DocumentOut])
def list_documents(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    q = db.query(Document).filter(Document.superseded_by == None)
    if entity_type:
        q = q.filter(Document.entity_type == entity_type)
    if entity_id:
        q = q.filter(Document.entity_id == entity_id)
    if category:
        q = q.filter(Document.category == category)
    return q.order_by(Document.uploaded_at.desc()).all()


@document_router.get("/{doc_id}/download-url")
def get_download_url(
    doc_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    r2 = get_r2_client()
    url = r2.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": doc.file_key},
        ExpiresIn=900,  # 15 minutes
    )
    log_action(db, current_user.id, "DOWNLOAD", "document", doc_id,
               ip_address=request.client.host)
    return {"url": url, "expires_in": 900}
