from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Break circular/FK references first
    conn.execute(text("UPDATE speed_events SET incident_id = NULL"))
    conn.execute(text("UPDATE compliance_categories SET created_by = NULL"))

    # Clear operational data
    conn.execute(text("DELETE FROM incident_escalations"))
    conn.execute(text("DELETE FROM expiry_alerts"))
    conn.execute(text("DELETE FROM documents"))
    conn.execute(text("DELETE FROM audit_logs"))
    conn.execute(text("DELETE FROM driver_compliance_records"))
    conn.execute(text("DELETE FROM checklist_faults"))
    conn.execute(text("DELETE FROM checklist_submissions"))
    conn.execute(text("DELETE FROM job_cards"))
    conn.execute(text("DELETE FROM planned_maintenance"))
    conn.execute(text("DELETE FROM tyre_records"))
    conn.execute(text("DELETE FROM vehicle_licensing_items"))
    conn.execute(text("DELETE FROM incidents"))
    conn.execute(text("DELETE FROM speed_events"))
    conn.execute(text("DELETE FROM drivers"))
    conn.execute(text("DELETE FROM vehicles"))

    # Delete users except your admin — update this email to match yours
    conn.execute(text("DELETE FROM users WHERE email != 'safety@inzu-mcs.com'"))
    conn.execute(text("DELETE FROM users WHERE email != 'traker@inzu-mcs.com'"))
    conn.execute(text("DELETE FROM users WHERE email != 'manager@inzu-mcs.com'"))
    conn.execute(text("DELETE FROM users WHERE email != 'operations.manager@inzu-mcs.com'"))

    conn.commit()
    print("Done — all operational data and non-admin users cleared.")
    print("Compliance categories and admin account kept intact.")