from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.vehicles import router as vehicles_router
from app.routers.drivers import router as drivers_router
from app.routers.speed_events import router as speed_events_router
from app.routers.documents import incident_router, document_router
from app.routers.maintenance import router as maintenance_router
from app.routers.driver_compliance import router as driver_compliance_router
from app.routers.incidents import router as incidents_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="INZU TMIS API",
    description="Transport Management Information System — INZU MCS Limited",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:3000",
    "https://quattro-tms.vercel.app/",      # ← add this
    "https://quattro-tms.vercel.app/", # ← add your actual domain later
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,             prefix="/api")
app.include_router(vehicles_router,         prefix="/api")
app.include_router(drivers_router,          prefix="/api")
app.include_router(speed_events_router,     prefix="/api")
app.include_router(incidents_router,        prefix="/api")
app.include_router(document_router,         prefix="/api")
app.include_router(maintenance_router,      prefix="/api")
app.include_router(driver_compliance_router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
