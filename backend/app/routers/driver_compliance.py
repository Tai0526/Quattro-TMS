from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import (
    ComplianceCategory, DriverComplianceRecord, Driver, User
)
from app.core.deps import require_supervisor, require_manager, require_any, require_admin, require_safety
from app.middleware.audit import log_action
from app.services.compliance import calculate_driver_compliance
import boto3
from botocore.config import Config
from app.config import settings
import uuid

router = APIRouter(prefix="/driver-compliance", tags=["driver-compliance"])


def r2():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


# ── Categories (admin only) ───────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db), _: User = Depends(require_any)):
    return db.query(ComplianceCategory).filter(
        ComplianceCategory.is_active == True
    ).order_by(ComplianceCategory.name).all()


@router.post("/categories", status_code=201)
def create_category(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    is_required: bool = Form(True),
    has_expiry: bool = Form(False),
    weight: int = Form(1),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_safety),
):
    cat = ComplianceCategory(
        name=name,
        description=description,
        is_required=is_required,
        has_expiry=has_expiry,
        weight=weight,
        created_by=current_user.id,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    log_action(db, current_user.id, "CREATE", "compliance_category", cat.id,
               new_value={"name": name}, ip_address=request.client.host if request else None)
    return cat


@router.patch("/categories/{cat_id}")
def update_category(
    cat_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_required: Optional[bool] = Form(None),
    has_expiry: Optional[bool] = Form(None),
    weight: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    cat = db.query(ComplianceCategory).filter(ComplianceCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    if name is not None: cat.name = name
    if description is not None: cat.description = description
    if is_required is not None: cat.is_required = is_required
    if has_expiry is not None: cat.has_expiry = has_expiry
    if weight is not None: cat.weight = weight
    if is_active is not None: cat.is_active = is_active
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(
    cat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    cat = db.query(ComplianceCategory).filter(ComplianceCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.is_active = False
    db.commit()


# ── Driver compliance records ─────────────────────────────────────────

@router.get("/drivers/{driver_id}")
def get_driver_compliance(driver_id: str, db: Session = Depends(get_db), _: User = Depends(require_any)):
    categories = db.query(ComplianceCategory).filter(ComplianceCategory.is_active == True).all()
    records = db.query(DriverComplianceRecord).filter(
        DriverComplianceRecord.driver_id == driver_id
    ).all()
    record_map = {r.category_id: r for r in records}

    result = []
    for cat in categories:
        rec = record_map.get(cat.id)
        result.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "description": cat.description,
            "is_required": cat.is_required,
            "has_expiry": cat.has_expiry,
            "weight": cat.weight,
            "record": {
                "id": rec.id if rec else None,
                "is_compliant": rec.is_compliant if rec else False,
                "expiry_date": rec.expiry_date.isoformat() if rec and rec.expiry_date else None,
                "certificate_file_name": rec.certificate_file_name if rec else None,
                "notes": rec.notes if rec else None,
                "verified_by": rec.verified_by if rec else None,
                "verified_at": rec.verified_at.isoformat() if rec and rec.verified_at else None,
            } if rec else None,
        })
    return result


@router.post("/drivers/{driver_id}/records", status_code=201)
async def upsert_driver_record(
    driver_id: str,
    category_id: str = Form(...),
    is_compliant: bool = Form(...),
    expiry_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    certificate: Optional[UploadFile] = File(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    cert_key, cert_name = None, None
    if certificate and certificate.filename:
        content = await certificate.read()
        cert_key = f"driver-compliance/{driver_id}/{category_id}/{uuid.uuid4()}_{certificate.filename}"
        r2().put_object(
            Bucket=settings.R2_BUCKET_NAME, Key=cert_key, Body=content,
            ContentType=certificate.content_type or "application/octet-stream",
        )
        cert_name = certificate.filename

    exp = datetime.fromisoformat(expiry_date) if expiry_date else None

    existing = db.query(DriverComplianceRecord).filter(
        DriverComplianceRecord.driver_id == driver_id,
        DriverComplianceRecord.category_id == category_id,
    ).first()

    if existing:
        existing.is_compliant = is_compliant
        existing.expiry_date  = exp
        existing.notes        = notes
        existing.verified_by  = current_user.id
        existing.verified_at  = datetime.utcnow()
        if cert_key:
            existing.certificate_file_key  = cert_key
            existing.certificate_file_name = cert_name
        db.commit()
        db.refresh(existing)
        log_action(db, current_user.id, "UPDATE", "driver_compliance_record", existing.id,
                   ip_address=request.client.host if request else None)
        return existing
    else:
        rec = DriverComplianceRecord(
            driver_id=driver_id,
            category_id=category_id,
            is_compliant=is_compliant,
            expiry_date=exp,
            notes=notes,
            certificate_file_key=cert_key,
            certificate_file_name=cert_name,
            verified_by=current_user.id,
            verified_at=datetime.utcnow(),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        log_action(db, current_user.id, "CREATE", "driver_compliance_record", rec.id,
                   ip_address=request.client.host if request else None)
        return rec


@router.get("/drivers/{driver_id}/score")
def driver_compliance_score(driver_id: str, db: Session = Depends(get_db), _: User = Depends(require_any)):
    return calculate_driver_compliance(driver_id, db)


@router.get("/score/fleet")
def fleet_compliance_overview(db: Session = Depends(get_db), _: User = Depends(require_any)):
    from app.services.compliance import get_fleet_compliance_summary, get_driver_compliance_summary
    return {
        "vehicles": get_fleet_compliance_summary(db),
        "drivers":  get_driver_compliance_summary(db),
    }
