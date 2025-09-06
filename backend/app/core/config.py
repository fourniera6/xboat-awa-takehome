# backend/app/core/config.py
from typing import List
from pydantic_settings import BaseSettings  # <-- v2 import

class Settings(BaseSettings):
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = ["*"]
    OPENMETEO_TIMEOUT_S: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
