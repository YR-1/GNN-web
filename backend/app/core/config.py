from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Supabase
    supabase_url: str
    supabase_key: str
    
    # Database
    database_url: str
    
    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # API
    api_title: str = "Data Analytics API"
    api_version: str = "1.0.0"
    debug: bool = False

    # Uploads
    upload_tmp_dir: str = "/tmp"
    max_upload_size_mb: int = 50
    
    # CORS
    allowed_origins: list = ["http://localhost:3000", "http://localhost:8000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
