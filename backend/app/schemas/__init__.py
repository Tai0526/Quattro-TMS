from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "viewer"


class UserUpdatePayload(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Vehicle ───────────────────────────────────────────────────────────

class VehicleCreate(BaseModel):
    reg_plate: str
    fleet_no: Optional[str] = None
    make: str
    model: str
    year: int
    colour: Optional[str] = None
    capacity: Optional[int] = None
    status: str = "active"
    notes: Optional[str] = None


class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    colour: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    fleet_no: Optional[str] = None


class VehicleOut(BaseModel):
    id: str
    reg_plate: str
    fleet_no: Optional[str] = None
    make: str
    model: str
    year: int
    colour: Optional[str] = None
    capacity: Optional[int] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Driver ────────────────────────────────────────────────────────────

class DriverCreate(BaseModel):
    full_name: str
    employee_no: str
    phone: Optional[str] = None
    email: Optional[str] = None
    licence_no: Optional[str] = None
    licence_class: Optional[str] = None
    licence_expiry: Optional[datetime] = None
    psv_expiry: Optional[datetime] = None
    medical_expiry: Optional[datetime] = None
    status: str = "active"
    notes: Optional[str] = None


class DriverUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    licence_no: Optional[str] = None
    licence_class: Optional[str] = None
    licence_expiry: Optional[datetime] = None
    psv_expiry: Optional[datetime] = None
    medical_expiry: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class DriverOut(BaseModel):
    id: str
    full_name: str
    employee_no: str
    phone: Optional[str] = None
    email: Optional[str] = None
    licence_no: Optional[str] = None
    licence_class: Optional[str] = None
    licence_expiry: Optional[datetime] = None
    psv_expiry: Optional[datetime] = None
    medical_expiry: Optional[datetime] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Document ──────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    category: str
    file_key: Optional[str] = None
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    version: int = 1
    notes: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Speed event ───────────────────────────────────────────────────────

class SpeedEventCreate(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    event_datetime: datetime
    recorded_speed: float
    speed_limit: float
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    location_description: Optional[str] = None
    tracker_source: str = "Geotab"
    tracker_event_id: Optional[str] = None


class SpeedEventUpdate(BaseModel):
    driver_id: Optional[str] = None
    status: Optional[str] = None
    dispute_narrative: Optional[str] = None


class SpeedEventOut(BaseModel):
    id: str
    vehicle_id: str
    driver_id: Optional[str] = None
    event_datetime: datetime
    recorded_speed: float
    speed_limit: float
    location_description: Optional[str] = None
    tracker_source: str
    tracker_event_id: Optional[str] = None
    status: str
    dispute_narrative: Optional[str] = None
    incident_id: Optional[str] = None
    logged_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Incident ──────────────────────────────────────────────────────────

class IncidentCreate(BaseModel):
    incident_type: str
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    event_datetime: datetime
    severity: str
    description: str
    location: Optional[str] = None


class IncidentUpdate(BaseModel):
    severity: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    outcome: Optional[str] = None
    assigned_to: Optional[str] = None


class IncidentOut(BaseModel):
    id: str
    incident_type: str
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    event_datetime: datetime
    severity: str
    description: str
    location: Optional[str] = None
    status: str
    outcome: Optional[str] = None
    rejection_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    manager_reviewed_at: Optional[datetime] = None
    ops_reviewed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)