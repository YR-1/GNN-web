from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class FileUploadRequest(BaseModel):
    """Schema for file upload request."""
    user_id: str
    file_name: str
    file_size: int


class FileUploadResponse(BaseModel):
    """Schema for file upload response."""
    upload_id: str
    execution_id: str
    status: str
    message: str


class ModelExecutionRequest(BaseModel):
    """Schema for model execution request."""
    user_id: str
    upload_id: str
    data_file_path: str


class ModelExecutionResponse(BaseModel):
    """Schema for model execution response."""
    execution_id: str
    status: str
    message: str


class AnalysisResult(BaseModel):
    """Schema for analysis result with statistics."""
    mean: float
    median: float
    std_dev: float
    min: float
    max: float
    quartiles: Dict[str, float]
    distribution: Dict[str, Any]


class ROICorrelationResult(BaseModel):
    """Schema for ROI correlation matrix analysis result."""
    n_rois: int
    n_timepoints: int
    correlation_matrix: List[List[float]]
    plotly_json: Dict[str, Any]
    file_size: int
    file_name: str


class AnalysisResponse(BaseModel):
    """Schema for analysis API response."""
    upload_id: str
    execution_id: str
    status: str
    results: Optional[Any] = None
    completed_at: Optional[datetime] = None


class UploadHistory(BaseModel):
    """Schema for upload history item."""
    upload_id: str
    file_name: str
    uploaded_at: datetime
    status: str
    execution_id: Optional[str] = None


class UploadContentResponse(BaseModel):
    """Schema for upload content preview."""
    upload_id: str
    file_name: str
    content: str
    truncated: bool
    lines_returned: int


class BulkDeleteRequest(BaseModel):
    """Schema for bulk upload deletion."""
    upload_ids: List[str]


class BulkDeleteResponse(BaseModel):
    """Schema for bulk upload deletion response."""
    deleted_count: int
    upload_ids: List[str]


class DashboardStats(BaseModel):
    """Schema for dashboard statistics."""
    total_uploads: int
    completed_analyses: int
    pending_analyses: int
    avg_processing_time: float


class ExecutionStatus(BaseModel):
    """Schema for checking execution status."""
    execution_id: str
    status: str
    progress: int
    results: Optional[Any] = None


class ScatterPoint(BaseModel):
    """Predicted vs actual score point for model scatter plot."""
    actual: float
    predicted: float


class ModelPerformanceItem(BaseModel):
    """Model performance metrics for a behavioral score."""
    id: str
    behavioralScore: str
    correlation: float
    pValue: float
    mse: float
    scatterData: List[ScatterPoint]


class SignupRequest(BaseModel):
    """Schema for user signup."""
    email: str
    password: str


class LoginRequest(BaseModel):
    """Schema for user login."""
    email: str
    password: str


class AuthResponse(BaseModel):
    """Schema for auth response."""
    access_token: str
    user_id: str
    email: str
