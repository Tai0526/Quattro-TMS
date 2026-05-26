from app.database import SessionLocal
from app.models import ComplianceCategory, User

db = SessionLocal()
admin = db.query(User).first()

cats = [
    {"name": "Medicals",                  "has_expiry": True,  "is_required": True,  "weight": 2},
    {"name": "Silicosis",                 "has_expiry": True,  "is_required": True,  "weight": 2},
    {"name": "General induction",         "has_expiry": False, "is_required": True,  "weight": 1},
    {"name": "Hand protection",           "has_expiry": False, "is_required": True,  "weight": 1},
    {"name": "Lightning awareness",       "has_expiry": False, "is_required": True,  "weight": 1},
    {"name": "Site induction",            "has_expiry": False, "is_required": True,  "weight": 1},
    {"name": "Think level 1",             "has_expiry": False, "is_required": True,  "weight": 1},
    {"name": "First aid",                 "has_expiry": True,  "is_required": True,  "weight": 1},
    {"name": "Pit induction",             "has_expiry": False, "is_required": True,  "weight": 1},
    {"name": "Fibrous material handling", "has_expiry": False, "is_required": True,  "weight": 1},
]

for c in cats:
    exists = db.query(ComplianceCategory).filter(ComplianceCategory.name == c["name"]).first()
    if not exists:
        db.add(ComplianceCategory(**c, created_by=admin.id if admin else None))

db.commit()
db.close()
print("Done — 10 compliance categories created")