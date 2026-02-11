import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from typing import Optional
from pathlib import Path
from tempfile import gettempdir
from ..models.schemas import (
    FileUploadResponse,
    ModelExecutionResponse,
    AnalysisResponse,
    DashboardStats,
    ExecutionStatus,
    UploadContentResponse,
)
from ..core.security import verify_token
from ..core.config import get_settings
from ..services.model_service import process_txt_data, store_execution_results, execute_notebook_with_file
from ..services.database import get_db_connection
from datetime import datetime
import json

router = APIRouter(prefix="/api", tags=["analytics"])

# Allowed file extensions
ALLOWED_EXTENSIONS = {".txt"}
CHUNK_SIZE = 1024 * 1024  # 1MB


async def _get_conn_or_500():
    try:
        return await get_db_connection()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    token_data: dict = Depends(verify_token),
) -> FileUploadResponse:
    """
    Upload TXT file (ROI time-series data) and trigger background correlation analysis.
    Returns upload_id for tracking.
    """
    settings = get_settings()

    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .txt files are allowed")
    
    user_id = token_data.get("sub")
    upload_id = str(uuid.uuid4())
    execution_id = str(uuid.uuid4())
    
    # Save file locally for processing (stream to avoid large memory usage)
    tmp_dir = Path(settings.upload_tmp_dir or gettempdir())
    tmp_dir.mkdir(parents=True, exist_ok=True)
    file_path = tmp_dir / f"{upload_id}.txt"
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
    
    # Record in database
    conn = await _get_conn_or_500()
    try:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO file_uploads (upload_id, user_id, file_name, file_size, file_path, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                upload_id,
                user_id,
                file.filename,
                file_size,
                str(file_path),
                "uploaded",
                datetime.utcnow(),
            )
            await conn.execute(
                """
                INSERT INTO model_executions (execution_id, upload_id, user_id, status, created_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                execution_id,
                upload_id,
                user_id,
                "queued",
                datetime.utcnow(),
            )
    finally:
        await conn.close()
    
    # Add background task to process TXT and compute correlation matrix using the notebook
    background_tasks.add_task(execute_notebook_with_file, str(file_path), execution_id, user_id, file.filename, file_size)
    
    return FileUploadResponse(
        upload_id=upload_id,
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
    
    conn = await _get_conn_or_500()
    try:
        row = await conn.fetchrow(
            """
            SELECT me.execution_id, fu.upload_id, me.status, me.results, me.completed_at
            FROM model_executions me
            JOIN file_uploads fu ON me.upload_id = fu.upload_id
            WHERE me.execution_id = $1 AND me.user_id = $2
            """,
            execution_id,
            user_id,
        )
    finally:
        await conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution_id, upload_id, status, results_json, completed_at = row
    results = json.loads(results_json) if results_json else None
    
    return AnalysisResponse(
        upload_id=upload_id,
        execution_id=execution_id,
        status=status,
        results=results,
        completed_at=completed_at,
    )


@router.get("/status/{execution_id}", response_model=ExecutionStatus)
async def get_status(
    execution_id: str,
    token_data: dict = Depends(verify_token),
) -> ExecutionStatus:
    """Check execution status with real-time updates."""
    user_id = token_data.get("sub")
    
    conn = await _get_conn_or_500()
    try:
        row = await conn.fetchrow(
            """
            SELECT execution_id, status, results
            FROM model_executions
            WHERE execution_id = $1 AND user_id = $2
            """,
            execution_id,
            user_id,
        )
    finally:
        await conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution_id, status, results_json = row
    results = json.loads(results_json) if results_json else None
    
    # Calculate progress
    progress = 100 if status == "completed" else (50 if status == "processing" else 0)
    
    return ExecutionStatus(
        execution_id=execution_id,
        status=status,
        progress=progress,
        results=results,
    )


@router.get("/history", response_model=list)
async def get_history(
    token_data: dict = Depends(verify_token),
):
    """Get user's upload history."""
    user_id = token_data.get("sub")
    
    conn = await _get_conn_or_500()
    try:
        rows = await conn.fetch(
            """
            SELECT fu.upload_id, fu.file_name, fu.created_at, fu.status, me.execution_id
            FROM file_uploads fu
            LEFT JOIN model_executions me ON fu.upload_id = me.upload_id
            WHERE fu.user_id = $1
            ORDER BY fu.created_at DESC
            LIMIT 50
            """,
            user_id,
        )
    finally:
        await conn.close()
    
    return [
        {
            "upload_id": row["upload_id"],
            "file_name": row["file_name"],
            "uploaded_at": row["created_at"],
            "status": row["status"],
            "execution_id": row["execution_id"],
        }
        for row in rows
    ]


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

    conn = await _get_conn_or_500()
    try:
        row = await conn.fetchrow(
            """
            SELECT file_name, file_path
            FROM file_uploads
            WHERE upload_id = $1 AND user_id = $2
            """,
            upload_id,
            user_id,
        )
    finally:
        await conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")

    file_name, file_path = row
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


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats() -> DashboardStats:
    """Get dashboard statistics."""
    # For now, return dummy stats (no auth required for demo)
    return DashboardStats(
        total_uploads=2,
        completed_analyses=1,
        pending_analyses=1,
        avg_processing_time=5.2,
    )
