from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TripMate"
    app_version: str = "0.1.0"
    debug: bool = True

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # Exact pricing provider: "none" (off) or "sample" (development-only generated prices).
    pricing_provider: str = "none"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
