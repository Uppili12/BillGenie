from fastapi import FastAPI
from pydantic import BaseModel

from .catalog import router as catalog_router


class HealthStatus(BaseModel):
    status: str


app = FastAPI(title="BillGenie", docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(catalog_router)


@app.get("/health", response_model=HealthStatus)
def health() -> HealthStatus:
    return HealthStatus(status="ok")
