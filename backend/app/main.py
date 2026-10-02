from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.errors import validation_error_handler
from app.db.session import engine
from app.modules.bills.router import router as bills_router

app = FastAPI(
    title="Minhas Contas",
    description="API para organização de contas por competência mensal.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.include_router(bills_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["Saúde"], summary="Verificar disponibilidade da API")
def health_check() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}
