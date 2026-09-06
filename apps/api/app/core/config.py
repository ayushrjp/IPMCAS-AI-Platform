from typing import List, Union, Optional
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "IPMCAS API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ipmcas"
    
    # Supabase
    SUPABASE_URL: str = "https://qlfguyqyhkgplywmrqdn.supabase.co"
    SUPABASE_ANON_KEY: str = "placeholder-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "placeholder-service-role-key"
    
    # LLM Provider Configuration
    # All keys here are read from Render environment variables via pydantic-settings.
    # GEMINI_API_KEY takes priority when set; falls back to OPENAI_API_KEY, then LLM_API_KEY.
    LLM_PROVIDER: str = "openai"
    LLM_API_KEY: str = "placeholder-key"
    LLM_MODEL: str = "gpt-4o"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None
    # Gemini fields — must be declared here so pydantic-settings reads them from env
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: Optional[str] = None
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "https://ipmcas-web.onrender.com"]
    
    @validator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
