import os
import secrets
from datetime import timedelta


MAX_IMAGE_SIZE = 10 * 1024 * 1024


class Config:
    CORS_ORIGINS = [
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip() and origin.strip() != "*"
    ]
    UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
    DATABASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "rootpulse.sqlite3"))
    MAX_CONTENT_LENGTH = MAX_IMAGE_SIZE + (1024 * 1024)
    SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "").strip()
    if SECRET_KEY.lower() in {"", "replace_with_a_random_secret", "change_me", "placeholder"}:
        SECRET_KEY = secrets.token_hex(32)
    SESSION_COOKIE_NAME = "rootpulse_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").strip().lower() in {"1", "true", "yes"}
    SESSION_COOKIE_PATH = "/"
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
    if GEMINI_API_KEY.lower() in {"your_google_gemini_api_key_here", "replace_me", "placeholder"}:
        GEMINI_API_KEY = ""
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip() or "gemini-3.5-flash"

    CROP_MODEL_REPO = os.getenv("CROP_MODEL_REPO", "BiernyVR/crop-disease-classifier")
    CROP_MODEL_REVISION = os.getenv("CROP_MODEL_REVISION", "3b75000f61dbfaca85a28000544fe479d2561b6b")
    MODEL_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "hf-cache"))
    CROP_MODEL_MIN_SCORE = float(os.getenv("CROP_MODEL_MIN_SCORE", "0.60"))
    CROP_MODEL_MIN_MARGIN = float(os.getenv("CROP_MODEL_MIN_MARGIN", "0.08"))

    # Illustrative defaults only; adjust after local agronomic review.
    IRRIGATION_MOISTURE_LOW = float(os.getenv("IRRIGATION_MOISTURE_LOW", "30"))
    IRRIGATION_MOISTURE_HIGH = float(os.getenv("IRRIGATION_MOISTURE_HIGH", "70"))
    IRRIGATION_SEEDLING_ADJUSTMENT = float(os.getenv("IRRIGATION_SEEDLING_ADJUSTMENT", "5"))
    IRRIGATION_VEGETATIVE_ADJUSTMENT = float(os.getenv("IRRIGATION_VEGETATIVE_ADJUSTMENT", "0"))
    IRRIGATION_FLOWERING_ADJUSTMENT = float(os.getenv("IRRIGATION_FLOWERING_ADJUSTMENT", "5"))
    IRRIGATION_FRUITING_ADJUSTMENT = float(os.getenv("IRRIGATION_FRUITING_ADJUSTMENT", "5"))
    IRRIGATION_MATURITY_ADJUSTMENT = float(os.getenv("IRRIGATION_MATURITY_ADJUSTMENT", "-5"))
    RAIN_SMART_MIN_MM = float(os.getenv("RAIN_SMART_MIN_MM", "5"))
    RAIN_SMART_MIN_PROBABILITY = float(os.getenv("RAIN_SMART_MIN_PROBABILITY", "60"))
    OPEN_METEO_TIMEOUT_SECONDS = int(os.getenv("OPEN_METEO_TIMEOUT_SECONDS", "6"))
