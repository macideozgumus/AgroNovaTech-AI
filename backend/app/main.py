from fastapi import FastAPI
from app.routes.health import router as health_router
from app.api.v1.parcels import router as parcels_router
from app.api.v1.villages import router as villages_router
from app.api.v1.decisions import router as decisions_router

app = FastAPI(
    title="AgroNovaTech-AI Backend",
    description="Bilincli Ciftci Koyu - Koy Bazli Akilli Tarim Karar Destek Sistemi",
    version="1.0.0"
)

@app.get("/")
def root():
    return {"message": "AgroNovaTech-AI backend is running", "version": "1.0.0"}

app.include_router(health_router)
app.include_router(parcels_router, prefix="/api/v1")
app.include_router(villages_router, prefix="/api/v1")
app.include_router(decisions_router, prefix="/api/v1")