from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TripMate"
    app_version: str = "0.1.0"
    debug: bool = True

    # PostgreSQL. The test suite uses test_database_url and never touches the main database.
    database_url: str = "postgresql+asyncpg://localhost:5432/tripmate"
    test_database_url: str = "postgresql+asyncpg://localhost:5432/tripmate_test"

    # Browsers allowed to call the API with cookies (comma-separated).
    cors_origins: str = "http://localhost:5173"

    # Signs email codes so a leaked database can't be used to guess them. Set your own in .env.
    otp_secret: str = "change-me-in-env"

    # Ollama and the three models TripMate uses.
    ollama_base_url: str = "http://localhost:11434"
    ollama_llm_model: str = "gemma4:e2b-mlx"  # writing: requests, itineraries, edits
    ollama_decision_model: str = "tev1:0.8b"  # yes/no and label checks
    ollama_embed_model: str = "qwen3-embedding:0.6b"  # search by meaning

    # Exact pricing provider: "none" (off) or "sample" (development-only generated prices).
    pricing_provider: str = "none"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ollama_models(self) -> dict[str, str]:
        return {"llm": self.ollama_llm_model, "decision": self.ollama_decision_model, "embedding": self.ollama_embed_model}


settings = Settings()
