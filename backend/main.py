from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.model_registry import build_model_registry, ensure_model_registry_dir
from app.core.preflight import run_dependency_preflight
from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.services.model_service import configure_torch_runtime, preload_configured_score_models

settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    debug=settings.debug,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include routers
app.include_router(analytics_router)
app.include_router(auth_router)


@app.on_event("startup")
async def startup_dependency_check():
    """Print dependency health before serving requests."""
    run_dependency_preflight(strict=settings.strict_dependency_check)
    configure_torch_runtime(settings)
    model_registry_dir = ensure_model_registry_dir(settings)
    model_registry = build_model_registry(settings)
    print(f"[Model Registry] Directory: {model_registry_dir}")
    for score_name, metadata in model_registry["models"].items():
        status = "FOUND" if metadata["exists"] else "MISSING"
        print(f"  - {score_name}: {metadata['filename']} [{status}]")
    preload_configured_score_models(settings)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Data Analytics API",
        "version": settings.api_version,
        "docs": "/docs",
    }
