import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
COORDINATES_PATTERN = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")


class WeatherServiceError(Exception):
    """Raised when a location or forecast cannot be retrieved."""


def _get_json(url: str, parameters: dict, timeout: int) -> dict:
    request_url = url + "?" + urlencode(parameters)
    request = Request(request_url, headers={"User-Agent": "RootPulseAI/0.1"})
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise WeatherServiceError("The weather service could not be reached. Try again shortly.") from error
    if not isinstance(payload, dict):
        raise WeatherServiceError("The weather service returned an unexpected response.")
    if payload.get("error"):
        raise WeatherServiceError("The weather service could not find a forecast for this location.")
    return payload


def _resolve_location(location: str, timeout: int) -> dict:
    coordinates = COORDINATES_PATTERN.fullmatch(location)
    if coordinates:
        latitude, longitude = map(float, coordinates.groups())
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise WeatherServiceError("Enter coordinates as latitude, longitude within valid ranges.")
        return {
            "latitude": latitude,
            "longitude": longitude,
            "name": "Field coordinates",
            "country": "",
            "admin1": "",
        }

    result = _get_json(
        GEOCODING_URL,
        {"name": location, "count": 1, "language": "en", "format": "json"},
        timeout,
    )
    locations = result.get("results") or []
    if not locations:
        raise WeatherServiceError("No matching location was found. Try a nearby city or coordinates.")
    return locations[0]


def get_weather(location: str, timeout: int = 6) -> dict:
    query = location.strip()
    if not query:
        raise WeatherServiceError("Enter a city or coordinates to load local weather.")

    resolved = _resolve_location(query, timeout)
    forecast = _get_json(
        FORECAST_URL,
        {
            "latitude": resolved["latitude"],
            "longitude": resolved["longitude"],
            "current": "temperature_2m,relative_humidity_2m,precipitation",
            "hourly": "precipitation,precipitation_probability",
            "forecast_hours": 24,
            "timezone": "auto",
        },
        timeout,
    )

    current = forecast.get("current") or {}
    hourly = forecast.get("hourly") or {}
    precip_values = hourly.get("precipitation") or []
    probability_values = hourly.get("precipitation_probability") or []
    if current.get("temperature_2m") is None or current.get("relative_humidity_2m") is None:
        raise WeatherServiceError("The forecast did not include current temperature and humidity.")

    rainfall = round(sum(float(value) for value in precip_values if value is not None), 1)
    probabilities = [float(value) for value in probability_values if value is not None]
    location_parts = [resolved.get("name"), resolved.get("admin1"), resolved.get("country")]
    display_location = ", ".join(dict.fromkeys(part for part in location_parts if part))

    return {
        "source": "Open-Meteo",
        "location": display_location or "Selected field location",
        "temperature_c": round(float(current["temperature_2m"]), 1),
        "humidity_pct": int(round(float(current["relative_humidity_2m"]))),
        "current_precipitation_mm": round(float(current.get("precipitation") or 0), 1),
        "rainfall_next_24h_mm": rainfall,
        "precipitation_probability_max_pct": max(probabilities) if probabilities else None,
        "forecast_timestamp": current.get("time"),
        "timezone": forecast.get("timezone"),
    }
