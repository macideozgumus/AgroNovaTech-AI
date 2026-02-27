from fastapi import FastAPI
from app.routes.health import router as health_router

app = FastAPI(title="AgroNovaTech-AI Backend")

@app.get("/")
def root():
    return {"message": "AgroNovaTech-AI backend is running"}

app.include_router(health_router)