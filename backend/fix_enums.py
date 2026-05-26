from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'safety'"))
    conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'workshop'"))
    conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'tracker'"))
    conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'operations_manager'"))
    conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'upper_management'"))
    conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'supervisor'"))
    conn.commit()
    print("Done — all role values added")