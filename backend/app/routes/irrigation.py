import math

from flask import Blueprint, current_app, jsonify, request

from ..auth import login_required
from ..services.irrigation_advisor import build_recommendation
from ..services.weather import WeatherServiceError, get_weather

irrigation_bp = Blueprint("irrigation", __name__)

CROPS = {"tomato": "Tomato", "potato": "Potato", "rice": "Rice", "maize": "Maize"}
GROWTH_STAGES = {
    "seedling": "Seedling",
    "vegetative": "Vegetative",
    "flowering": "Flowering",
    "fruiting": "Fruiting",
    "maturity": "Maturity",
}
SOIL_TYPES = {"sandy": "Sandy", "loamy": "Loamy", "clay": "Clay", "silt": "Silt"}
FIELD_SIZE_UNITS = {"hectares", "acres"}


@irrigation_bp.get("/weather")
@login_required
def current_weather():
    location = request.args.get("location", "").strip()
    if not location or len(location) > 180:
        return jsonify({"error": "Enter a city or coordinates to load local weather."}), 400
    try:
        weather = get_weather(location, current_app.config["OPEN_METEO_TIMEOUT_SECONDS"])
    except WeatherServiceError as error:
        return jsonify({"error": str(error)}), 422
    return jsonify({"weather": weather})


def _optional_text(payload, key, allowed=None):
    value = payload.get(key)
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError(f"{key} must be text.")
    normalized = value.strip().lower()
    if allowed is not None:
        if normalized not in allowed:
            raise ValueError(f"Choose a supported {key.replace('_', ' ')}.")
        return allowed[normalized]
    if len(value.strip()) > 180:
        raise ValueError(f"{key.replace('_', ' ').capitalize()} is too long.")
    return value.strip() or None


@irrigation_bp.post("/irrigation/recommend")
@login_required
def irrigation_recommendation():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send irrigation details as a JSON object."}), 400

    try:
        crop_name = _optional_text(payload, "crop_name", CROPS)
        growth_stage = _optional_text(payload, "growth_stage", GROWTH_STAGES)
        soil_type = _optional_text(payload, "soil_type", SOIL_TYPES)
        location = _optional_text(payload, "location")
        notes = _optional_text(payload, "notes")

        moisture_value = payload.get("soil_moisture")
        if moisture_value in ("", None):
            soil_moisture = None
        elif isinstance(moisture_value, bool) or not isinstance(moisture_value, (int, float)):
            raise ValueError("soil_moisture must be a number from 0 to 100.")
        elif not math.isfinite(float(moisture_value)) or not 0 <= moisture_value <= 100:
            raise ValueError("soil_moisture must be between 0 and 100.")
        else:
            soil_moisture = float(moisture_value)

        field_size_value = payload.get("field_size")
        field_size_unit = payload.get("field_size_unit", "hectares")
        if field_size_value in ("", None):
            field_size = None
        elif isinstance(field_size_value, bool) or not isinstance(field_size_value, (int, float)):
            raise ValueError("field_size must be a positive number.")
        elif not math.isfinite(float(field_size_value)) or field_size_value <= 0:
            raise ValueError("field_size must be greater than 0.")
        elif field_size_unit not in FIELD_SIZE_UNITS:
            raise ValueError("field_size_unit must be hectares or acres.")
        else:
            field_size = float(field_size_value)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    data = {
        "crop_name": crop_name,
        "growth_stage": growth_stage,
        "soil_type": soil_type,
        "soil_moisture": soil_moisture,
        "location": location,
        "field_size": field_size,
        "field_size_unit": field_size_unit,
        "notes": notes,
    }

    missing = any(value is None for value in (crop_name, growth_stage, soil_type, soil_moisture))
    weather = None
    weather_status = "not_requested"
    weather_message = "Complete crop details and moisture before requesting a forecast."
    if not missing and location:
        try:
            weather = get_weather(location, current_app.config["OPEN_METEO_TIMEOUT_SECONDS"])
            weather_status = "available"
            weather_message = None
        except WeatherServiceError as error:
            weather_status = "error"
            weather_message = str(error)
    elif not missing:
        weather_status = "missing_location"
        weather_message = "Add a city or coordinates to include a live rainfall forecast."

    result = build_recommendation(
        data=data,
        weather=weather,
        weather_status=weather_status,
        weather_message=weather_message,
        config=current_app.config,
    )
    return jsonify(result), 200
