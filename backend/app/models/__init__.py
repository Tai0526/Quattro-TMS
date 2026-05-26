from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text,
    ForeignKey, Float, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum, uuid

from app.database import Base

def gen_uuid(): return str(uuid.uuid4())

# ── Enums ─────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin              = "admin"
    operations_manager = "operations_manager"
    manager            = "manager"
    supervisor         = "supervisor"
    safety             = "safety"
    workshop           = "workshop"
    tracker            = "tracker"
    upper_management   = "upper_management"
    viewer             = "viewer"

class VehicleStatus(str, enum.Enum):
    active      = "active"
    grounded    = "grounded"
    maintenance = "maintenance"

class DriverStatus(str, enum.Enum):
    active     = "active"
    suspended  = "suspended"
    terminated = "terminated"

class DocumentCategory(str, enum.Enum):
    road_tax            = "road_tax"
    insurance           = "insurance"
    fitness_certificate = "fitness_certificate"
    zra_sticker         = "zra_sticker"
    third_party_liability = "third_party_liability"
    drivers_licence     = "drivers_licence"
    psv_permit          = "psv_permit"
    medical_certificate = "medical_certificate"
    other               = "other"

class SpeedEventStatus(str, enum.Enum):
    flagged   = "flagged"
    in_review = "in_review"
    disputed  = "disputed"
    confirmed = "confirmed"
    closed    = "closed"

class IncidentType(str, enum.Enum):
    speed               = "speed"
    accident            = "accident"
    near_miss           = "near_miss"
    mechanical          = "mechanical"
    passenger_complaint = "passenger_complaint"
    road_condition      = "road_condition"
    other               = "other"

class IncidentSeverity(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"

class IncidentStatus(str, enum.Enum):
    draft             = "draft"
    submitted         = "submitted"
    manager_review    = "manager_review"
    ops_review        = "ops_review"
    closed            = "closed"
    rejected          = "rejected"

class AlertChannel(str, enum.Enum):
    email = "email"
    sms   = "sms"

class MaintenanceType(str, enum.Enum):
    service    = "service"
    inspection = "inspection"
    greasing   = "greasing"
    other      = "other"

class MaintenanceStatus(str, enum.Enum):
    upcoming  = "upcoming"
    overdue   = "overdue"
    completed = "completed"

class JobCardStatus(str, enum.Enum):
    open        = "open"
    in_progress = "in_progress"
    completed   = "completed"
    cancelled   = "cancelled"

class FaultSeverity(str, enum.Enum):
    minor    = "minor"
    moderate = "moderate"
    critical = "critical"

class LicensingItemType(str, enum.Enum):
    insurance           = "insurance"
    road_tax            = "road_tax"
    fitness_certificate = "fitness_certificate"
    fqm_inspection      = "fqm_inspection"
    zra_sticker         = "zra_sticker"
    other               = "other"

class TyrePosition(str, enum.Enum):
    front_left  = "front_left"
    front_right = "front_right"
    rear_left   = "rear_left"
    rear_right  = "rear_right"
    spare       = "spare"
    other       = "other"

class ComplianceStatus(str, enum.Enum):
    compliant = "compliant"
    warning   = "warning"
    critical  = "critical"

# ── Core models ───────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id              = Column(String, primary_key=True, default=gen_uuid)
    email           = Column(String, unique=True, nullable=False, index=True)
    full_name       = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(SAEnum(UserRole), nullable=False, default=UserRole.viewer)
    is_active       = Column(Boolean, default=True)
    phone           = Column(String)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())
    audit_logs      = relationship("AuditLog", back_populates="user")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id         = Column(String, primary_key=True, default=gen_uuid)
    reg_plate  = Column(String, unique=True, nullable=False, index=True)
    fleet_no   = Column(String, unique=True, nullable=True, index=True)
    make       = Column(String, nullable=False)
    model      = Column(String, nullable=False)
    year       = Column(Integer, nullable=False)
    colour     = Column(String)
    capacity   = Column(Integer)
    status     = Column(SAEnum(VehicleStatus), default=VehicleStatus.active)
    notes      = Column(Text)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    speed_events      = relationship("SpeedEvent", back_populates="vehicle")
    incidents         = relationship("Incident", back_populates="vehicle")
    licensing_items   = relationship("VehicleLicensingItem", back_populates="vehicle")
    maintenance_plans = relationship("PlannedMaintenance", back_populates="vehicle")
    tyre_records      = relationship("TyreRecord", back_populates="vehicle")
    checklist_submissions = relationship("ChecklistSubmission", back_populates="vehicle")
    job_cards         = relationship("JobCard", back_populates="vehicle")

class Driver(Base):
    __tablename__ = "drivers"
    id             = Column(String, primary_key=True, default=gen_uuid)
    full_name      = Column(String, nullable=False)
    employee_no    = Column(String, unique=True, nullable=False, index=True)
    phone          = Column(String)
    email          = Column(String)
    licence_no     = Column(String, unique=True)
    licence_class  = Column(String)
    licence_expiry = Column(DateTime(timezone=True))
    psv_expiry     = Column(DateTime(timezone=True))
    medical_expiry = Column(DateTime(timezone=True))
    status         = Column(SAEnum(DriverStatus), default=DriverStatus.active)
    notes          = Column(Text)
    created_by     = Column(String, ForeignKey("users.id"))
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())
    speed_events        = relationship("SpeedEvent", back_populates="driver")
    incidents           = relationship("Incident", back_populates="driver")
    compliance_records  = relationship("DriverComplianceRecord", back_populates="driver")

class Document(Base):
    __tablename__ = "documents"
    id           = Column(String, primary_key=True, default=gen_uuid)
    entity_type  = Column(String, nullable=False)
    entity_id    = Column(String, nullable=False, index=True)
    category     = Column(SAEnum(DocumentCategory), nullable=False)
    file_key     = Column(String, nullable=False)
    file_name    = Column(String, nullable=False)
    file_size    = Column(Integer)
    mime_type    = Column(String)
    version      = Column(Integer, default=1)
    superseded_by = Column(String, ForeignKey("documents.id"), nullable=True)
    expiry_date  = Column(DateTime(timezone=True), nullable=True)
    ocr_text     = Column(Text)
    notes        = Column(Text)
    uploaded_by  = Column(String, ForeignKey("users.id"))
    uploaded_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())
    uploader     = relationship("User", foreign_keys=[uploaded_by])
    expiry_alerts = relationship("ExpiryAlert", back_populates="document")

class SpeedEvent(Base):
    __tablename__ = "speed_events"
    id                = Column(String, primary_key=True, default=gen_uuid)
    vehicle_id        = Column(String, ForeignKey("vehicles.id"), nullable=False)
    driver_id         = Column(String, ForeignKey("drivers.id"), nullable=True)
    event_datetime    = Column(DateTime(timezone=True), nullable=False)
    recorded_speed    = Column(Float, nullable=False)
    speed_limit       = Column(Float, nullable=False)
    gps_lat           = Column(Float)
    gps_lng           = Column(Float)
    location_description = Column(String)
    tracker_source    = Column(String, default="Geotab")
    tracker_event_id  = Column(String)
    status            = Column(SAEnum(SpeedEventStatus), default=SpeedEventStatus.flagged)
    dispute_narrative = Column(Text)
    incident_id       = Column(String, ForeignKey("incidents.id"), nullable=True)
    logged_by         = Column(String, ForeignKey("users.id"))
    logged_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())
    vehicle  = relationship("Vehicle", back_populates="speed_events")
    driver   = relationship("Driver", back_populates="speed_events")
    incident = relationship("Incident", foreign_keys=[incident_id], back_populates="source_speed_event")

class Incident(Base):
    __tablename__ = "incidents"
    id            = Column(String, primary_key=True, default=gen_uuid)
    incident_type = Column(SAEnum(IncidentType), nullable=False)
    vehicle_id    = Column(String, ForeignKey("vehicles.id"), nullable=True)
    driver_id     = Column(String, ForeignKey("drivers.id"), nullable=True)
    event_datetime = Column(DateTime(timezone=True), nullable=False)
    severity      = Column(SAEnum(IncidentSeverity), nullable=False)
    description   = Column(Text, nullable=False)
    location      = Column(String)
    status        = Column(SAEnum(IncidentStatus), default=IncidentStatus.draft)
    outcome       = Column(Text)
    rejection_reason = Column(Text)
    assigned_to   = Column(String, ForeignKey("users.id"), nullable=True)
    submitted_at  = Column(DateTime(timezone=True), nullable=True)
    manager_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    manager_reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)
    ops_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    ops_reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)
    closed_at     = Column(DateTime(timezone=True), nullable=True)
    created_by    = Column(String, ForeignKey("users.id"))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())
    vehicle  = relationship("Vehicle", back_populates="incidents")
    driver   = relationship("Driver", back_populates="incidents")
    source_speed_event = relationship("SpeedEvent", foreign_keys="SpeedEvent.incident_id", back_populates="incident", uselist=False)
    escalation_log = relationship("IncidentEscalation", back_populates="incident")

class IncidentEscalation(Base):
    __tablename__ = "incident_escalations"
    id           = Column(String, primary_key=True, default=gen_uuid)
    incident_id  = Column(String, ForeignKey("incidents.id"), nullable=False)
    from_status  = Column(String, nullable=False)
    to_status    = Column(String, nullable=False)
    escalated_by = Column(String, ForeignKey("users.id"))
    notes        = Column(Text)
    escalated_at = Column(DateTime(timezone=True), server_default=func.now())
    incident     = relationship("Incident", back_populates="escalation_log")

class ExpiryAlert(Base):
    __tablename__ = "expiry_alerts"
    id             = Column(String, primary_key=True, default=gen_uuid)
    document_id    = Column(String, ForeignKey("documents.id"), nullable=False)
    threshold_days = Column(Integer, nullable=False)
    channel        = Column(SAEnum(AlertChannel), nullable=False)
    recipient      = Column(String, nullable=False)
    sent_at        = Column(DateTime(timezone=True), server_default=func.now())
    document       = relationship("Document", back_populates="expiry_alerts")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id          = Column(String, primary_key=True, default=gen_uuid)
    user_id     = Column(String, ForeignKey("users.id"), nullable=True)
    action      = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id   = Column(String, nullable=True)
    old_value   = Column(JSON, nullable=True)
    new_value   = Column(JSON, nullable=True)
    ip_address  = Column(String)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now())
    user        = relationship("User", back_populates="audit_logs")

# ── Vehicle Maintenance models ─────────────────────────────────────────

class VehicleLicensingItem(Base):
    __tablename__ = "vehicle_licensing_items"
    id          = Column(String, primary_key=True, default=gen_uuid)
    vehicle_id  = Column(String, ForeignKey("vehicles.id"), nullable=False)
    item_type   = Column(SAEnum(LicensingItemType), nullable=False)
    is_critical = Column(Boolean, default=True)
    weight      = Column(Integer, default=3)
    issue_date  = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    issuer      = Column(String)
    reference_no = Column(String)
    file_key    = Column(String)
    file_name   = Column(String)
    notes       = Column(Text)
    created_by  = Column(String, ForeignKey("users.id"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
    vehicle     = relationship("Vehicle", back_populates="licensing_items")

class ChecklistSubmission(Base):
    __tablename__ = "checklist_submissions"
    id            = Column(String, primary_key=True, default=gen_uuid)
    vehicle_id    = Column(String, ForeignKey("vehicles.id"), nullable=False)
    driver_id     = Column(String, ForeignKey("drivers.id"), nullable=True)
    submission_date = Column(DateTime(timezone=True), nullable=False)
    scan_file_key = Column(String)
    scan_file_name = Column(String)
    has_faults    = Column(Boolean, default=False)
    notes         = Column(Text)
    submitted_by  = Column(String, ForeignKey("users.id"))
    submitted_at  = Column(DateTime(timezone=True), server_default=func.now())
    vehicle = relationship("Vehicle", back_populates="checklist_submissions")
    faults  = relationship("ChecklistFault", back_populates="submission")

class ChecklistFault(Base):
    __tablename__ = "checklist_faults"
    id              = Column(String, primary_key=True, default=gen_uuid)
    submission_id   = Column(String, ForeignKey("checklist_submissions.id"), nullable=False)
    fault_description = Column(Text, nullable=False)
    severity        = Column(SAEnum(FaultSeverity), default=FaultSeverity.minor)
    job_card_id     = Column(String, ForeignKey("job_cards.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    submission = relationship("ChecklistSubmission", back_populates="faults")
    job_card   = relationship("JobCard", foreign_keys=[job_card_id])

class JobCard(Base):
    __tablename__ = "job_cards"
    id                = Column(String, primary_key=True, default=gen_uuid)
    vehicle_id        = Column(String, ForeignKey("vehicles.id"), nullable=False)
    fault_description = Column(Text, nullable=False)
    severity          = Column(SAEnum(FaultSeverity), default=FaultSeverity.minor)
    status            = Column(SAEnum(JobCardStatus), default=JobCardStatus.open)
    assigned_to       = Column(String, ForeignKey("users.id"), nullable=True)
    parts_used        = Column(JSON)
    resolution_notes  = Column(Text)
    completed_at      = Column(DateTime(timezone=True), nullable=True)
    reported_by       = Column(String, ForeignKey("users.id"))
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())
    vehicle = relationship("Vehicle", back_populates="job_cards")

class PlannedMaintenance(Base):
    __tablename__ = "planned_maintenance"
    id                = Column(String, primary_key=True, default=gen_uuid)
    vehicle_id        = Column(String, ForeignKey("vehicles.id"), nullable=False)
    maintenance_type  = Column(SAEnum(MaintenanceType), nullable=False)
    description       = Column(String)
    due_date          = Column(DateTime(timezone=True), nullable=True)
    last_done_date    = Column(DateTime(timezone=True), nullable=True)
    interval_days     = Column(Integer, nullable=True)
    status            = Column(SAEnum(MaintenanceStatus), default=MaintenanceStatus.upcoming)
    completed_by      = Column(String, ForeignKey("users.id"), nullable=True)
    completion_notes  = Column(Text)
    created_by        = Column(String, ForeignKey("users.id"))
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())
    vehicle = relationship("Vehicle", back_populates="maintenance_plans")

class TyreRecord(Base):
    __tablename__ = "tyre_records"
    id              = Column(String, primary_key=True, default=gen_uuid)
    vehicle_id      = Column(String, ForeignKey("vehicles.id"), nullable=False)
    position        = Column(SAEnum(TyrePosition), nullable=False)
    brand           = Column(String)
    size            = Column(String)
    changed_date    = Column(DateTime(timezone=True), nullable=False)
    next_due_date   = Column(DateTime(timezone=True), nullable=True)
    next_due_km     = Column(Integer, nullable=True)
    notes           = Column(Text)
    recorded_by     = Column(String, ForeignKey("users.id"))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    vehicle = relationship("Vehicle", back_populates="tyre_records")

# ── Driver compliance models ──────────────────────────────────────────

class ComplianceCategory(Base):
    __tablename__ = "compliance_categories"
    id          = Column(String, primary_key=True, default=gen_uuid)
    name        = Column(String, nullable=False)
    description = Column(Text)
    is_required = Column(Boolean, default=True)
    has_expiry  = Column(Boolean, default=False)
    weight      = Column(Integer, default=1)
    is_active   = Column(Boolean, default=True)
    created_by  = Column(String, ForeignKey("users.id"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    records     = relationship("DriverComplianceRecord", back_populates="category")

class DriverComplianceRecord(Base):
    __tablename__ = "driver_compliance_records"
    id              = Column(String, primary_key=True, default=gen_uuid)
    driver_id       = Column(String, ForeignKey("drivers.id"), nullable=False)
    category_id     = Column(String, ForeignKey("compliance_categories.id"), nullable=False)
    is_compliant    = Column(Boolean, default=False)
    expiry_date     = Column(DateTime(timezone=True), nullable=True)
    certificate_file_key  = Column(String)
    certificate_file_name = Column(String)
    notes           = Column(Text)
    verified_by     = Column(String, ForeignKey("users.id"), nullable=True)
    verified_at     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())
    driver   = relationship("Driver", back_populates="compliance_records")
    category = relationship("ComplianceCategory", back_populates="records")
