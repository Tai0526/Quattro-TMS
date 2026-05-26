from app.database import engine, SessionLocal
from app.models import User, UserRole
from app.core.security import hash_password
import uuid

db = SessionLocal()

email    = "admin@quattro.co.zm"   # ← change this
password = "Quattro2026"            # ← change this
fullname = "Taizya Kasitu"  # ← change this

existing = db.query(User).filter(User.email == email).first()
if existing:
    print(f"User {email} already exists.")
else:
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        full_name=fullname,
        hashed_password=hash_password(password),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    print(f"Admin user created: {email}")

db.close()