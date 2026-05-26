from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import (
    Vehicle, VehicleLicensingItem, PlannedMaintenance, TyreRecord,
    Driver, DriverComplianceRecord, ComplianceCategory, MaintenanceStatus
)


def calculate_vehicle_compliance(vehicle_id: str, db: Session) -> dict:
    """Weighted compliance score with critical item override."""
    now = datetime.now(timezone.utc)
    issues = []
    total_weight = 0
    earned_weight = 0
    critical_failed = False

    # Licensing items (critical ones weight=3, standard weight=1)
    items = db.query(VehicleLicensingItem).filter(
        VehicleLicensingItem.vehicle_id == vehicle_id
    ).all()

    for item in items:
        w = item.weight or (3 if item.is_critical else 1)
        total_weight += w
        if item.expiry_date:
            exp = item.expiry_date
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < now:
                if item.is_critical:
                    critical_failed = True
                    issues.append(f"{item.item_type.value.replace('_',' ').title()} EXPIRED (critical)")
                else:
                    issues.append(f"{item.item_type.value.replace('_',' ').title()} expired")
            else:
                earned_weight += w
        else:
            # No expiry date set yet — treat as non-compliant
            issues.append(f"{item.item_type.value.replace('_',' ').title()} — no expiry date set")

    if critical_failed:
        return {"score": 0, "status": "critical", "issues": issues, "critical_override": True}

    # Planned maintenance
    plans = db.query(PlannedMaintenance).filter(
        PlannedMaintenance.vehicle_id == vehicle_id
    ).all()
    for plan in plans:
        total_weight += 1
        if plan.status == MaintenanceStatus.overdue:
            issues.append(f"{plan.maintenance_type.value.title()} overdue")
        else:
            earned_weight += 1

    # Tyres — check if any past due date
    tyres = db.query(TyreRecord).filter(TyreRecord.vehicle_id == vehicle_id).all()
    for tyre in tyres:
        if tyre.next_due_date:
            total_weight += 1
            exp = tyre.next_due_date
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < now:
                issues.append(f"Tyre {tyre.position.value.replace('_',' ')} overdue")
            else:
                earned_weight += 1

    if total_weight == 0:
        return {"score": 100, "status": "compliant", "issues": [], "critical_override": False}

    score = round((earned_weight / total_weight) * 100)
    status = "compliant" if score >= 90 else "warning" if score >= 70 else "critical"

    return {"score": score, "status": status, "issues": issues, "critical_override": False}


def calculate_driver_compliance(driver_id: str, db: Session) -> dict:
    """Percentage of required compliance categories that are current."""
    now = datetime.now(timezone.utc)
    categories = db.query(ComplianceCategory).filter(
        ComplianceCategory.is_active == True,
        ComplianceCategory.is_required == True,
    ).all()

    if not categories:
        return {"score": 100, "status": "compliant", "issues": [], "total": 0, "compliant": 0}

    total = len(categories)
    compliant_count = 0
    issues = []

    for cat in categories:
        record = db.query(DriverComplianceRecord).filter(
            DriverComplianceRecord.driver_id == driver_id,
            DriverComplianceRecord.category_id == cat.id,
        ).first()

        if not record or not record.is_compliant:
            issues.append(f"{cat.name} — not completed")
            continue

        if cat.has_expiry and record.expiry_date:
            exp = record.expiry_date
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < now:
                issues.append(f"{cat.name} — expired")
                continue

        compliant_count += 1

    score = round((compliant_count / total) * 100) if total > 0 else 100
    status = "compliant" if score >= 90 else "warning" if score >= 70 else "critical"

    return {
        "score": score,
        "status": status,
        "issues": issues,
        "total": total,
        "compliant": compliant_count,
    }


def get_fleet_compliance_summary(db: Session) -> dict:
    vehicles = db.query(Vehicle).filter(Vehicle.status != "terminated").all()
    scores = [calculate_vehicle_compliance(v.id, db) for v in vehicles]
    avg = round(sum(s["score"] for s in scores) / len(scores)) if scores else 0
    critical_count = sum(1 for s in scores if s["status"] == "critical")
    warning_count  = sum(1 for s in scores if s["status"] == "warning")
    return {
        "fleet_score": avg,
        "total_vehicles": len(vehicles),
        "critical": critical_count,
        "warning": warning_count,
        "compliant": len(scores) - critical_count - warning_count,
    }


def get_driver_compliance_summary(db: Session) -> dict:
    drivers = db.query(Driver).filter(Driver.status == "active").all()
    scores = [calculate_driver_compliance(d.id, db) for d in drivers]
    avg = round(sum(s["score"] for s in scores) / len(scores)) if scores else 0
    critical_count = sum(1 for s in scores if s["status"] == "critical")
    warning_count  = sum(1 for s in scores if s["status"] == "warning")
    return {
        "driver_score": avg,
        "total_drivers": len(drivers),
        "critical": critical_count,
        "warning": warning_count,
        "compliant": len(scores) - critical_count - warning_count,
    }
