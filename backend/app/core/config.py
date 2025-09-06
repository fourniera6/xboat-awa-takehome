from pydantic import BaseSettings
from typing import List

class Settings(BaseSettings):
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = ["*"]
    OPENMETEO_TIMEOUT_S: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
