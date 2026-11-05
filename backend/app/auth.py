from functools import wraps

from flask import current_app, g, jsonify, session

from .services.progress_store import connect


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user_id = session.get("user_id")
        if not isinstance(user_id, int):
            return jsonify({"status": "unauthenticated", "error": "Please log in to continue."}), 401
        with connect(current_app.config["DATABASE_PATH"]) as connection:
            user = connection.execute(
                """
                SELECT id, full_name, username, phone, created_at, auth_version,
                       (recovery_answer1_hash IS NOT NULL AND recovery_answer2_hash IS NOT NULL) AS recovery_configured
                FROM users WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
        if user is None or session.get("auth_version") != user["auth_version"]:
            session.clear()
            return jsonify({"status": "unauthenticated", "error": "Your session has expired. Please log in again."}), 401
        g.auth_user = user
        return view(*args, **kwargs)
    return wrapped


def safe_user(user):
    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "username": user["username"],
        "phone": user["phone"],
        "created_at": user["created_at"],
        "recovery_configured": bool(user["recovery_configured"]) if "recovery_configured" in user.keys() else False,
    }
