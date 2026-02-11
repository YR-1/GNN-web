import asyncpg
from ..core.config import get_settings


async def get_db_connection():
    """Get async database connection."""
    settings = get_settings()

    if not settings.database_url or "$" in settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    try:
        ssl = None
        if "supabase.co" in settings.database_url and "sslmode=" not in settings.database_url:
            ssl = "require"
        return await asyncpg.connect(settings.database_url, ssl=ssl)
    except Exception as e:
        raise RuntimeError(f"Could not connect to database: {e}") from e


async def init_db() -> None:
    """Initialize database connection pool (call on startup)."""
    # This is typically handled by Alembic migrations
    pass
