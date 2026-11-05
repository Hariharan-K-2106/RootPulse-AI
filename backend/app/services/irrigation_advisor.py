def moisture_status(soil_moisture, growth_stage, config):
    adjustment_key = "IRRIGATION_" + growth_stage.upper() + "_ADJUSTMENT"
    adjustment = float(config.get(adjustment_key, 0))
    low_threshold = float(config["IRRIGATION_MOISTURE_LOW"]) + adjustment
    high_threshold = float(config["IRRIGATION_MOISTURE_HIGH"])

    if soil_moisture < low_threshold:
        status = "low"
    elif soil_moisture >= high_threshold:
        status = "high"
    else:
        status = "adequate"

    return status, low_threshold, high_threshold


def build_recommendation(data, weather, weather_status, weather_message, config):
    required_fields = {
        "crop_name": "crop",
        "growth_stage": "growth stage",
        "soil_type": "soil type",
        "soil_moisture": "manually entered soil moisture",
    }
    missing = [label for key, label in required_fields.items() if data.get(key) is None]
    crop_name = data.get("crop_name")
    growth_stage = data.get("growth_stage")
    moisture = data.get("soil_moisture")
    moisture_label = "unavailable"
    low_threshold = None
    high_threshold = float(config["IRRIGATION_MOISTURE_HIGH"])

    if moisture is not None and growth_stage:
        moisture_label, low_threshold, high_threshold = moisture_status(moisture, growth_stage, config)

    factors = []
    for field, label in (
        ("crop_name", "Crop"),
        ("growth_stage", "Growth stage"),
        ("soil_type", "Soil type"),
    ):
        value = data.get(field)
        if value is not None:
            factors.append({"label": label, "value": value, "role": "context"})
    if moisture is not None:
        factors.append({
            "label": "Manually entered soil moisture",
            "value": f"{moisture:g}%",
            "role": "moisture status",
        })
    if growth_stage and low_threshold is not None:
        factors.append({
            "label": "Illustrative thresholds",
            "value": f"Low below {low_threshold:g}%; high at or above {high_threshold:g}%",
            "role": "rule profile for this growth stage",
        })
    if data.get("field_size") is not None:
        factors.append({
            "label": "Field size",
            "value": f"{data['field_size']:g} {data['field_size_unit']}",
            "role": "context only; not used to estimate water quantity",
        })
    if data.get("notes"):
        factors.append({
            "label": "Field notes",
            "value": data["notes"],
            "role": "context only; notes are not interpreted by the rule",
        })

    base = {
        "status": "review_conditions",
        "crop_name": crop_name,
        "growth_stage": growth_stage,
        "soil_type": data.get("soil_type"),
        "soil_moisture": moisture,
        "moisture_status": moisture_label,
        "illustrative_thresholds": (
            {"low_below_pct": low_threshold, "high_at_or_above_pct": high_threshold}
            if low_threshold is not None else None
        ),
        "weather": weather,
        "weather_status": weather_status,
        "weather_message": weather_message,
        "rain_smart_alert": None,
        "input_factors": factors,
        "threshold_note": "Moisture thresholds are illustrative starting points, not validated crop-specific guidance.",
    }

    if missing:
        base["explanation"] = "Complete " + ", ".join(missing) + " to review irrigation conditions."
        base["next_action"] = "Add the missing crop and field details, then request a new advisory."
        return base

    if not data.get("location"):
        base["weather_status"] = "missing_location"
        base["weather_message"] = "Add a city or coordinates to include a live rainfall forecast."
        base["input_factors"].append({
            "label": "Weather forecast",
            "value": "Unavailable because no location was entered",
            "role": "not considered",
        })
        base["explanation"] = (
            f"Manual moisture is {moisture:g}% ({moisture_label}) for {crop_name} at the "
            f"{growth_stage.lower()} stage, but rainfall conditions are unknown."
        )
        base["next_action"] = "Enter the field location and check the local forecast before deciding."
        return base

    if weather_status != "available" or weather is None:
        base["explanation"] = (
            f"Manual moisture is {moisture:g}% ({moisture_label}), but local weather could not be "
            "confirmed, so the advisory stays in review."
        )
        base["next_action"] = "Check the location or try again when a forecast is available."
        base["input_factors"].append({
            "label": "Weather forecast",
            "value": "Unavailable",
            "role": "not considered",
        })
        return base

    rain_mm = weather["rainfall_next_24h_mm"]
    rain_probability = weather["precipitation_probability_max_pct"]
    minimum_mm = float(config["RAIN_SMART_MIN_MM"])
    minimum_probability = float(config["RAIN_SMART_MIN_PROBABILITY"])
    meaningful_rain = rain_mm >= minimum_mm or (
        rain_probability is not None and rain_probability >= minimum_probability
    )
    rain_description = f"{rain_mm:g} mm expected over the next 24 hours"
    if rain_probability is not None:
        rain_description += f", with up to {rain_probability:g}% precipitation probability"

    base["input_factors"].append({
        "label": "Live rainfall forecast",
        "value": rain_description,
        "role": "rain-smart check",
    })

    if meaningful_rain:
        base["status"] = "wait"
        base["rain_smart_alert"] = {
            "title": "Rain-smart alert",
            "message": (
                f"Rain is in the forecast ({rain_description}). Consider delaying irrigation "
                "and reassessing field conditions if the rain occurs."
            ),
        }
        base["explanation"] = (
            f"Moisture is {moisture:g}% ({moisture_label}) for {crop_name} at the "
            f"{growth_stage.lower()} stage. The live forecast suggests meaningful rainfall."
        )
        base["next_action"] = "Recheck field moisture after the forecast rain; do not use this as a guaranteed rainfall estimate."
        return base

    if moisture_label == "low":
        base["status"] = "irrigate"
        base["explanation"] = (
            f"Manually entered moisture ({moisture:g}%) is below the illustrative "
            f"{growth_stage.lower()} threshold of {low_threshold:g}%, and no meaningful rain "
            "is forecast for the next 24 hours."
        )
        base["next_action"] = "Consider irrigating, then reassess soil moisture in the field."
    elif moisture_label == "high":
        base["status"] = "wait"
        base["explanation"] = (
            f"Manually entered moisture ({moisture:g}%) is at or above the illustrative "
            f"high threshold of {high_threshold:g}% for the {growth_stage.lower()} stage."
        )
        base["next_action"] = "Wait and check the field again before watering."
    else:
        base["status"] = "wait"
        base["explanation"] = (
            f"Manually entered moisture ({moisture:g}%) is within the illustrative range for "
            f"{crop_name} at the {growth_stage.lower()} stage, and no meaningful rain is forecast."
        )
        base["next_action"] = "Wait and continue monitoring field conditions."

    return base
