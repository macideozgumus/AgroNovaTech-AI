from fastapi import FastAPI
from app.routes.health import router as health_router
from app.routes.parcels import router as parcels_router
from app.routes.risk import router as risk_router

app = FastAPI(title="AgroNovaTech-AI Backend")

@app.get("/")
def root():
    return {"message": "AgroNovaTech-AI backend is running"}

app.include_router(health_router)
app.include_router(parcels_router)
app.include_router(risk_router)