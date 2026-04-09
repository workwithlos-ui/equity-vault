from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost:5432/equity_vault"
    apollo_api_key: str = ""
    anthropic_api_key: str = ""
    app_name: str = "Equity Vault"
    cors_origins: list[str] = ["http://localhost:3000", "https://*.vercel.app"]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
