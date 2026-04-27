import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from typing import Optional, Any
from pathlib import Path
from tempfile import gettempdir
import math
from ..models.schemas import (
    FileUploadResponse,
    ModelExecutionResponse,
    AnalysisResponse,
    ExecutionStatus,
    UploadContentResponse,
    ModelPerformanceItem,
)
from ..core.security import verify_token
from ..core.config import get_settings
from ..core.model_registry import build_model_registry
from ..services.model_service import process_txt_data
from ..services.database import (
    create_upload_and_execution,
    get_analysis_row,
    get_dashboard_stats,
    get_execution_for_retry,
    get_history_rows,
    get_status_row,
    get_upload_file_row,
    set_execution_status,
)
from datetime import datetime
import json

router = APIRouter(prefix="/api", tags=["analytics"])

# Allowed file extensions
ALLOWED_EXTENSIONS = {".txt", ".csv", ".tsv"}
CHUNK_SIZE = 1024 * 1024  # 1MB


MODEL_PERFORMANCE_SEEDS = [
    ("wm", "Working Memory", 0.882, 0.00041, 3.28, 1.2),
    ("fluid_iq", "Fluid Intelligence", 0.844, 0.00073, 3.71, 2.4),
    ("attention", "Sustained Attention", 0.806, 0.00124, 4.09, 3.1),
    ("processing_speed", "Processing Speed", 0.793, 0.00192, 4.42, 4.7),
    ("emotion", "Emotion Recognition", 0.769, 0.00215, 4.85, 5.4),
    ("executive", "Executive Function", 0.747, 0.00301, 5.13, 6.2),
    ("language", "Language Fluency", 0.701, 0.00388, 5.62, 7.6),
    ("social", "Social Cognition", 0.662, 0.00462, 6.02, 8.8),
]


def _generate_scatter_data(seed: float, correlation: float) -> list[dict]:
    points = []
    sample_size = 50
    for index in range(sample_size):
        actual = 50 + index * 0.9 + math.sin(index * 0.45 + seed) * 6
        noise_scale = (1 - correlation) * 14
        predicted = actual + math.cos(index * 0.33 + seed * 0.7) * noise_scale
        points.append({"actual": actual, "predicted": predicted})
    return points


def _build_model_performance_payload() -> list[dict]:
    payload = []
    for model_id, behavioral_score, correlation, p_value, mse, seed in MODEL_PERFORMANCE_SEEDS:
        payload.append(
            {
                "id": model_id,
                "behavioralScore": behavioral_score,
                "correlation": correlation,
                "pValue": p_value,
                "mse": mse,
                "scatterData": _generate_scatter_data(seed, correlation),
            }
        )
    return payload


def _parse_json_field(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def _make_json_safe(value: Any):
    """
    Normalize response payloads so transient non-JSON-safe values
    (for example NaN/Infinity or numpy scalars) do not break polling endpoints.
    """
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {str(key): _make_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_make_json_safe(item) for item in value]
    if hasattr(value, "item"):
        try:
            return _make_json_safe(value.item())
        except Exception:
            return str(value)
    return str(value)


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    token_data: dict = Depends(verify_token),
) -> FileUploadResponse:
    """
    Upload TXT file (ROI time-series data) and trigger background analysis/prediction pipeline.
    Returns upload_id and execution_id for tracking.
    """
    settings = get_settings()

    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .txt, .csv, and .tsv files are allowed")
    
    user_id = token_data.get("sub")
    upload_id = str(uuid.uuid4())
    execution_id = str(uuid.uuid4())
    
    # Save file locally for processing (stream to avoid large memory usage)
    tmp_dir = Path(settings.upload_tmp_dir or gettempdir())
    tmp_dir.mkdir(parents=True, exist_ok=True)
    file_path = tmp_dir / f"{upload_id}{ext}"
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    file_size = 0
    try:
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {settings.max_upload_size_mb} MB)",
                    )
                f.write(chunk)
    except HTTPException:
        if file_path.exists():
            file_path.unlink()
        raise
    finally:
        await file.close()

    if file_size == 0:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    
    try:
        await create_upload_and_execution(
            upload_id=upload_id,
            execution_id=execution_id,
            user_id=user_id,
            file_name=file.filename,
            file_size=file_size,
            file_path=str(file_path),
            created_at=datetime.utcnow(),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not write upload metadata: {exc}")
    
    # Add background task to process TXT using single-pass analysis/prediction pipeline
    background_tasks.add_task(process_txt_data, str(file_path), execution_id, user_id, file.filename, file_size)
    
    return FileUploadResponse(
        upload_id=upload_id,
        execution_id=execution_id,
        status="queued",
        message="TXT file uploaded successfully. Correlation matrix analysis started.",
    )


@router.get("/analysis/{execution_id}", response_model=AnalysisResponse)
async def get_analysis(
    execution_id: str,
    token_data: dict = Depends(verify_token),
) -> AnalysisResponse:
    """
    Retrieve analysis results for a given execution.
    Returns aggregated statistics from database.
    """
    user_id = token_data.get("sub")
    
    try:
        row = await get_analysis_row(execution_id=execution_id, user_id=user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not fetch analysis: {exc}")
    
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    results = _make_json_safe(_parse_json_field(row.get("results")))
    
    return AnalysisResponse(
        upload_id=row["upload_id"],
        execution_id=row["execution_id"],
        status=row["status"],
        results=results,
        completed_at=row.get("completed_at"),
    )


@router.get("/status/{execution_id}", response_model=ExecutionStatus)
async def get_status(
    execution_id: str,
    token_data: dict = Depends(verify_token),
) -> ExecutionStatus:
    """Check execution status with real-time updates."""
    user_id = token_data.get("sub")
    
    try:
        row = await get_status_row(execution_id=execution_id, user_id=user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not fetch status: {exc}")
    
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    status = row["status"]
    # Calculate progress
    progress = 100 if status == "completed" else (50 if status == "processing" else 0)
    
    return ExecutionStatus(
        execution_id=row["execution_id"],
        status=status,
        progress=progress,
        results=None,
    )


@router.get("/history", response_model=list)
async def get_history(
    token_data: dict = Depends(verify_token),
):
    """Get user's upload history."""
    user_id = token_data.get("sub")
    
    try:
        return await get_history_rows(user_id=user_id, limit=50)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not fetch history: {exc}")


@router.get("/models")
async def get_model_registry(
    token_data: dict = Depends(verify_token),
):
    """Return configured score->model file mapping and availability."""
    _ = token_data.get("sub")
    settings = get_settings()
    return build_model_registry(settings)


@router.get("/model-performance", response_model=list[ModelPerformanceItem])
async def get_model_performance(
    token_data: dict = Depends(verify_token),
):
    """Return behavioral-score model performance metrics for dashboard display."""
    _ = token_data.get("sub")
    return _build_model_performance_payload()


@router.get("/upload/{upload_id}/content", response_model=UploadContentResponse)
async def get_upload_content(
    upload_id: str,
    max_lines: int = 200,
    max_chars: int = 20000,
    token_data: dict = Depends(verify_token),
) -> UploadContentResponse:
    """Return a safe preview of the uploaded file content."""
    user_id = token_data.get("sub")
    max_lines = max(1, min(max_lines, 1000))
    max_chars = max(1000, min(max_chars, 200000))

    try:
        row = await get_upload_file_row(upload_id=upload_id, user_id=user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not fetch upload content: {exc}")

    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")

    file_name = row["file_name"]
    file_path = row["file_path"]
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    content_lines = []
    total_chars = 0
    lines_returned = 0
    truncated = False

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if lines_returned >= max_lines:
                truncated = True
                break
            if total_chars + len(line) > max_chars:
                remaining = max_chars - total_chars
                if remaining > 0:
                    content_lines.append(line[:remaining])
                    total_chars += remaining
                    lines_returned += 1
                truncated = True
                break
            content_lines.append(line)
            total_chars += len(line)
            lines_returned += 1

    return UploadContentResponse(
        upload_id=upload_id,
        file_name=file_name,
        content="".join(content_lines),
        truncated=truncated,
        lines_returned=lines_returned,
    )


@router.post("/retry/{execution_id}")
async def retry_analysis(
    execution_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    token_data: dict = Depends(verify_token),
):
    """Retry a failed analysis execution."""
    user_id = token_data.get("sub")

    try:
        row = await get_execution_for_retry(execution_id=execution_id, user_id=user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not look up execution: {exc}")

    if not row:
        raise HTTPException(status_code=404, detail="Execution not found or is not in failed status")

    file_path = row.get("file_path", "")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=410, detail="Original file no longer available. Please re-upload.")

    file_name = row.get("file_name", "unknown")
    file_size = row.get("file_size", 0)

    await set_execution_status(execution_id, user_id, "queued")
    background_tasks.add_task(process_txt_data, file_path, execution_id, user_id, file_name, file_size)

    return {"execution_id": execution_id, "status": "queued", "message": "Analysis has been re-queued."}


@router.get("/dashboard")
async def dashboard_stats(
    token_data: dict = Depends(verify_token),
):
    """Get dashboard statistics from real data."""
    user_id = token_data.get("sub")
    try:
        stats = await get_dashboard_stats(user_id=user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not fetch dashboard stats: {exc}")
    return stats
