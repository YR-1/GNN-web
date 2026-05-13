from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import Any, Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_role_key: str = ""
    
    # Legacy direct database URL (optional; kept for backward compatibility)
    database_url: str = ""
    
    # JWT
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # API
    api_title: str = "Data Analytics API"
    api_version: str = "1.0.0"
    debug: bool = False
    strict_dependency_check: bool = False

    # Uploads
    upload_tmp_dir: str = "/tmp"
    max_upload_size_mb: int = 50

    # Prediction model registry
    model_registry_dir: str = "./models"
    model_registry_scores: str = "listsort_ageadj,sleep_quality,emotsupp_unadj,picseq,pmat"

    # Expensive visualization artifacts. Keep false for faster upload/prediction.
    generate_plotly_json: bool = False
    generate_neuro_visuals: bool = True
    torch_num_threads: int = 4
    torch_num_interop_threads: int = 1
    
    # CORS
    allowed_origins: list = ["http://localhost:3000", "http://localhost:3001", "http://localhost:8000"]

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug_flag(cls, value: Any) -> Any:
        """Accept common logging/deployment labels for DEBUG without failing settings load."""
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production", "warn", "warning", "info"}:
                return False
            if normalized in {"dev", "development", "debug"}:
                return True
        return value

    def missing_supabase_fields(self) -> list[str]:
        missing = []
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if not self.supabase_key:
            missing.append("SUPABASE_KEY")
        return missing

    def missing_auth_fields(self) -> list[str]:
        missing = []
        if not self.jwt_secret:
            missing.append("JWT_SECRET")
        return missing

    def supabase_enabled(self) -> bool:
        return not self.missing_supabase_fields()

    def jwt_enabled(self) -> bool:
        return not self.missing_auth_fields()
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
