from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import (
    Vehicle, VehicleLicensingItem, ChecklistSubmission, ChecklistFault,
    JobCard, PlannedMaintenance, TyreRecord, User,
    LicensingItemType, FaultSeverity, JobCardStatus, MaintenanceType,
    MaintenanceStatus, TyrePosition
)
from app.core.deps import require_supervisor, require_manager, require_any, require_workshop
from app.middleware.audit import log_action
from app.services.compliance import calculate_vehicle_compliance
import boto3
from botocore.config import Config
from app.config import settings
import uuid

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def r2():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


# ── Licensing items ───────────────────────────────────────────────────

@router.get("/vehicles/{vehicle_id}/licensing")
def get_licensing_items(vehicle_id: str, db: Session = Depends(get_db), _: User = Depends(require_any)):
    return db.query(VehicleLicensingItem).filter(VehicleLicensingItem.vehicle_id == vehicle_id).all()


@router.post("/vehicles/{vehicle_id}/licensing", status_code=201)
async def upsert_licensing_item(
    vehicle_id: str,
    item_type: LicensingItemType = Form(...),
    issue_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    issuer: Optional[str] = Form(None),
    reference_no: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workshop),
):
    file_key, file_name = None, None
    if file and file.filename:
        content = await file.read()
        file_key = f"licensing/{vehicle_id}/{item_type}/{uuid.uuid4()}_{file.filename}"
        r2().put_object(Bucket=settings.R2_BUCKET_NAME, Key=file_key, Body=content,
                        ContentType=file.content_type or "application/octet-stream")
        file_name = file.filename

    is_critical = item_type in [
        LicensingItemType.insurance, LicensingItemType.road_tax,
        LicensingItemType.fitness_certificate, LicensingItemType.fqm_inspection
    ]

    existing = db.query(VehicleLicensingItem).filter(
        VehicleLicensingItem.vehicle_id == vehicle_id,
        VehicleLicensingItem.item_type == item_type,
    ).first()

    exp = datetime.fromisoformat(expiry_date) if expiry_date else None
    iss = datetime.fromisoformat(issue_date) if issue_date else None

    if existing:
        existing.expiry_date = exp
        existing.issue_date  = iss
        existing.issuer      = issuer
        existing.reference_no = reference_no
        existing.notes       = notes
        if file_key:
            existing.file_key  = file_key
            existing.file_name = file_name
        db.commit()
        db.refresh(existing)
        return existing
    else:
        item = VehicleLicensingItem(
            vehicle_id=vehicle_id, item_type=item_type,
            is_critical=is_critical, weight=3 if is_critical else 1,
            expiry_date=exp, issue_date=iss,
            issuer=issuer, reference_no=reference_no, notes=notes,
            file_key=file_key, file_name=file_name,
            created_by=current_user.id,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item


# ── Checklists ────────────────────────────────────────────────────────

@router.get("/vehicles/{vehicle_id}/checklists")
def get_checklists(
    vehicle_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any),
):
    q = db.query(ChecklistSubmission).filter(ChecklistSubmission.vehicle_id == vehicle_id)
    if date_from:
        q = q.filter(ChecklistSubmission.submission_date >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(ChecklistSubmission.submission_date <= datetime.fromisoformat(date_to))
    return q.order_by(ChecklistSubmission.submission_date.desc()).all()


@router.post("/vehicles/{vehicle_id}/checklists", status_code=201)
async def submit_checklist(
    vehicle_id: str,
    submission_date: str = Form(...),
    driver_id: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    faults: Optional[str] = Form(None),  # JSON string: [{"description":"...","severity":"minor"}]
    scan: Optional[UploadFile] = File(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    scan_key, scan_name = None, None
    if scan and scan.filename:
        content = await scan.read()
        scan_key = f"checklists/{vehicle_id}/{uuid.uuid4()}_{scan.filename}"
        r2().put_object(Bucket=settings.R2_BUCKET_NAME, Key=scan_key, Body=content,
                        ContentType=scan.content_type or "application/octet-stream")
        scan_name = scan.filename

    import json
    fault_list = json.loads(faults) if faults else []
    has_faults = len(fault_list) > 0

    submission = ChecklistSubmission(
        vehicle_id=vehicle_id,
        driver_id=driver_id,
        submission_date=datetime.fromisoformat(submission_date),
        scan_file_key=scan_key,
        scan_file_name=scan_name,
        has_faults=has_faults,
        notes=notes,
        submitted_by=current_user.id,
    )
    db.add(submission)
    db.flush()

    for f in fault_list:
        fault = ChecklistFault(
            submission_id=submission.id,
            fault_description=f.get("description", ""),
            severity=f.get("severity", "minor"),
        )
        db.add(fault)

    db.commit()
    db.refresh(submission)
    log_action(db, current_user.id, "CREATE", "checklist", submission.id,
               ip_address=request.client.host if request else None)
    return submission


# ── Job cards ─────────────────────────────────────────────────────────

@router.get("/vehicles/{vehicle_id}/job-cards")
def get_job_cards(vehicle_id: str, db: Session = Depends(get_db), _: User = Depends(require_any)):
    return db.query(JobCard).filter(JobCard.vehicle_id == vehicle_id)\
             .order_by(JobCard.created_at.desc()).all()


@router.post("/vehicles/{vehicle_id}/job-cards", status_code=201)
def create_job_card(
    vehicle_id: str,
    fault_description: str = Form(...),
    severity: FaultSeverity = Form(FaultSeverity.minor),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    card = JobCard(
        vehicle_id=vehicle_id,
        fault_description=fault_description,
        severity=severity,
        reported_by=current_user.id,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.patch("/job-cards/{card_id}")
def update_job_card(
    card_id: str,
    status: Optional[JobCardStatus] = Form(None),
    resolution_notes: Optional[str] = Form(None),
    parts_used: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    card = db.query(JobCard).filter(JobCard.id == card_id).first()
    if not card:
        raise HTTPException(404, "Job card not found")
    if status:
        card.status = status
        if status == JobCardStatus.completed:
            card.completed_at = datetime.utcnow()
    if resolution_notes:
        card.resolution_notes = resolution_notes
    if parts_used:
        import json
        card.parts_used = json.loads(parts_used)
    db.commit()
    db.refresh(card)
    return card


# ── Planned maintenance ───────────────────────────────────────────────

@router.get("/vehicles/{vehicle_id}/plans")
def get_plans(vehicle_id: str, db: Session = Depends(get_db), _: User = Depends(require_any)):
    return db.query(PlannedMaintenance).filter(PlannedMaintenance.vehicle_id == vehicle_id)\
             .order_by(PlannedMaintenance.due_date).all()


@router.post("/vehicles/{vehicle_id}/plans", status_code=201)
def create_plan(
    vehicle_id: str,
    maintenance_type: MaintenanceType = Form(...),
    description: Optional[str] = Form(None),
    due_date: Optional[str] = Form(None),
    interval_days: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    plan = PlannedMaintenance(
        vehicle_id=vehicle_id,
        maintenance_type=maintenance_type,
        description=description,
        due_date=datetime.fromisoformat(due_date) if due_date else None,
        interval_days=interval_days,
        created_by=current_user.id,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/plans/{plan_id}/complete")
def complete_plan(
    plan_id: str,
    completion_notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    plan = db.query(PlannedMaintenance).filter(PlannedMaintenance.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    plan.status = MaintenanceStatus.completed
    plan.last_done_date = datetime.utcnow()
    plan.completed_by = current_user.id
    plan.completion_notes = completion_notes
    if plan.interval_days:
        from datetime import timedelta
        plan.due_date = datetime.utcnow() + timedelta(days=plan.interval_days)
        plan.status = MaintenanceStatus.upcoming
    db.commit()
    db.refresh(plan)
    return plan


# ── Tyre records ──────────────────────────────────────────────────────

@router.get("/vehicles/{vehicle_id}/tyres")
def get_tyres(vehicle_id: str, db: Session = Depends(get_db), _: User = Depends(require_any)):
    return db.query(TyreRecord).filter(TyreRecord.vehicle_id == vehicle_id)\
             .order_by(TyreRecord.changed_date.desc()).all()


@router.post("/vehicles/{vehicle_id}/tyres", status_code=201)
def record_tyre_change(
    vehicle_id: str,
    position: TyrePosition = Form(...),
    brand: Optional[str] = Form(None),
    size: Optional[str] = Form(None),
    changed_date: str = Form(...),
    next_due_date: Optional[str] = Form(None),
    next_due_km: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    record = TyreRecord(
        vehicle_id=vehicle_id,
        position=position,
        brand=brand, size=size,
        changed_date=datetime.fromisoformat(changed_date),
        next_due_date=datetime.fromisoformat(next_due_date) if next_due_date else None,
        next_due_km=next_due_km,
        notes=notes,
        recorded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ── Compliance score ──────────────────────────────────────────────────

@router.get("/vehicles/{vehicle_id}/compliance-score")
def vehicle_compliance_score(vehicle_id: str, db: Session = Depends(get_db), _: User = Depends(require_any)):
    return calculate_vehicle_compliance(vehicle_id, db)


# ── Fault analytics ───────────────────────────────────────────────────

@router.get("/analytics/common-faults")
def common_faults(limit: int = 20, db: Session = Depends(get_db), _: User = Depends(require_any)):
    from sqlalchemy import text
    results = db.execute(
        text("SELECT fault_description, COUNT(*) as count FROM checklist_faults GROUP BY fault_description ORDER BY count DESC LIMIT :limit"),
        {"limit": limit}
    ).fetchall()
    return [{"fault": r[0], "count": r[1]} for r in results]
