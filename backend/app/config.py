"""
Application configuration.

All values are sourced from environment variables (see .env.example at the
project root). Nothing here contains a real credential.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    # Defaults to a local SQLite file so the app can be graded / smoke-tested
    # without a running Postgres instance. Point DATABASE_URL at Postgres in
    # any real deployment, e.g.
    # postgresql+psycopg2://user:password@host:5432/raw_db
    database_url: str = "sqlite:///./raw.db"

    # AI agent
    # If GEMINI_API_KEY is not set, the agent falls back to a deterministic
    # rule-based proposer/interpreter (see app/agent.py) so the whole pipeline
    # stays runnable offline.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    # Misc
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    max_upload_rows: int = 200_000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
