import json

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..services.chat_assistant import LANGUAGES, ChatServiceError, generate_reply
from ..services.progress_store import connect

chat_bp = Blueprint("chat", __name__)
MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_MESSAGES = 10


def _get_crop_context(database_path, crop_id):
    if crop_id is None:
        return {"selected_crop": None, "recent_observations": []}, None
    with connect(database_path) as connection:
        crop = connection.execute(
            "SELECT id, crop_name, field_name FROM crops WHERE id = ? AND user_id = ?",
            (crop_id, g.auth_user["id"]),
        ).fetchone()
        if crop is None:
            return None, None
        observations = connection.execute(
            """
            SELECT captured_at, note
            FROM progress_photos
            WHERE crop_id = ? AND note IS NOT NULL AND note != ''
            ORDER BY captured_at DESC, id DESC
            LIMIT 5
            """,
            (crop_id,),
        ).fetchall()
        analysis = connection.execute(
            """
            SELECT status, condition, candidate_condition, confidence,
                   explanation, next_steps_json, created_at
            FROM crop_analyses
            WHERE user_id = ? AND lower(crop_name) = lower(?)
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            (g.auth_user["id"], crop["crop_name"]),
        ).fetchone()
    context = {
        "selected_crop": {
            "crop_name": crop["crop_name"],
            "field_name": crop["field_name"],
        },
        "recent_observations": [
            {"captured_at": row["captured_at"], "farmer_note": row["note"]}
            for row in observations
        ],
        "latest_crop_analysis": None if analysis is None else {
            "status": analysis["status"],
            "condition": analysis["condition"],
            "candidate_condition": analysis["candidate_condition"],
            "confidence": analysis["confidence"],
            "explanation": analysis["explanation"],
            "next_steps": json.loads(analysis["next_steps_json"] or "[]"),
            "created_at": analysis["created_at"],
        },
    }
    return context, {
        "crop_name": crop["crop_name"],
        "field_name": crop["field_name"],
        "observation_count": len(observations),
        "has_latest_analysis": analysis is not None,
    }


@chat_bp.post("/chat")
@login_required
def chat():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"status": "error", "message": "Send the chat request as a JSON object."}), 400

    message = payload.get("message")
    language = payload.get("language")
    if not isinstance(message, str) or not message.strip():
        return jsonify({"status": "error", "message": "Enter a message before sending."}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"status": "error", "message": f"Messages must be {MAX_MESSAGE_LENGTH} characters or fewer."}), 413
    if not isinstance(language, str) or language not in LANGUAGES:
        return jsonify({"status": "error", "message": "Choose English, Tamil, or Hindi."}), 400

    crop_id = payload.get("crop_id")
    if crop_id is not None and (
        isinstance(crop_id, bool) or not isinstance(crop_id, int) or crop_id <= 0
    ):
        return jsonify({"status": "error", "message": "crop_id must be a positive integer or null."}), 400

    history = payload.get("history", [])
    if not isinstance(history, list) or len(history) > MAX_HISTORY_MESSAGES:
        return jsonify({"status": "error", "message": "Chat history must contain at most 10 recent messages."}), 400
    validated_history = []
    for item in history:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("role"), str)
            or item["role"] not in {"user", "assistant"}
        ):
            return jsonify({"status": "error", "message": "Chat history contains an invalid message."}), 400
        content = item.get("content")
        if not isinstance(content, str) or not content.strip() or len(content) > MAX_MESSAGE_LENGTH:
            return jsonify({"status": "error", "message": "Chat history contains an invalid message."}), 400
        validated_history.append({"role": item["role"], "content": content.strip()})

    context, context_summary = _get_crop_context(current_app.config["DATABASE_PATH"], crop_id)
    if context is None:
        return jsonify({"status": "error", "message": "Selected crop was not found. Refresh the crop list and try again."}), 404

    try:
        answer = generate_reply(
            message=message.strip(),
            language=language,
            context=context,
            history=validated_history,
            api_key=current_app.config.get("GEMINI_API_KEY", ""),
            model=current_app.config.get("GEMINI_MODEL", "gemini-3.5-flash"),
        )
    except ChatServiceError as error:
        return jsonify({
            "status": "not_configured" if not current_app.config.get("GEMINI_API_KEY") else "error",
            "message": str(error),
            "language": language,
            "context_used": context_summary,
        }), error.status_code

    return jsonify({
        "status": "ok",
        "response": answer,
        "language": language,
        "context_used": context_summary,
    })
