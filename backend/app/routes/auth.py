import hashlib
import re
import secrets
import sqlite3
import time
import unicodedata

from flask import Blueprint, current_app, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import login_required, safe_user
from ..services.progress_store import connect

auth_bp = Blueprint("auth", __name__)
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,32}$")
PHONE_PATTERN = re.compile(r"^\+?[0-9 ()-]{7,20}$")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
RECOVERY_GENERIC_MESSAGE = "We couldn't verify this account. Check your details or contact support."
RECOVERY_QUESTIONS = [
    "What is your pet name?",
    "What is the name of your childhood best friend?",
]
RECOVERY_WINDOW_SECONDS = 15 * 60
RECOVERY_TOKEN_SECONDS = 10 * 60


def _validation_error(message, status=400):
    return jsonify({"status": "error", "error": message}), status


def _no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def _recovery_error():
    response = jsonify({"status": "error", "message": RECOVERY_GENERIC_MESSAGE})
    response.status_code = 400
    return _no_store(response)


def _normalized_answer(value):
    if not isinstance(value, str):
        return None
    normalized = unicodedata.normalize("NFKC", value.strip()).casefold()
    if not normalized or len(normalized) > 200 or any(ord(ch) < 32 for ch in normalized):
        return None
    return normalized


def _rate_limited(connection, action, username_key, limit):
    """Count attempts by both normalized account identifier and client address."""
    now = int(time.time())
    remote_addr = request.remote_addr or "unknown-client"
    raw_keys = [f"{action}:account:{username_key}", f"{action}:client:{remote_addr}"]
    bucket_keys = [hashlib.sha256(item.encode("utf-8")).hexdigest() for item in raw_keys]
    connection.execute("DELETE FROM recovery_attempts WHERE window_started_at < ?", (now - 86400,))
    blocked = False
    for bucket_key in bucket_keys:
        row = connection.execute(
            "SELECT attempt_count, window_started_at FROM recovery_attempts WHERE bucket_key = ?",
            (bucket_key,),
        ).fetchone()
        if row is None or now - row["window_started_at"] >= RECOVERY_WINDOW_SECONDS:
            connection.execute(
                "INSERT OR REPLACE INTO recovery_attempts (bucket_key, attempt_count, window_started_at) VALUES (?, 1, ?)",
                (bucket_key, now),
            )
        else:
            if row["attempt_count"] >= limit:
                blocked = True
            else:
                connection.execute(
                    "UPDATE recovery_attempts SET attempt_count = attempt_count + 1 WHERE bucket_key = ?",
                    (bucket_key,),
                )
    return blocked


@auth_bp.post("/auth/register")
def register():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _validation_error("Send registration details as a JSON object.")

    full_name = payload.get("full_name")
    username = payload.get("username")
    password = payload.get("password")
    phone = payload.get("phone")
    answer1 = _normalized_answer(payload.get("security_answer1"))
    answer2 = _normalized_answer(payload.get("security_answer2"))
    if not isinstance(full_name, str) or not 2 <= len(full_name.strip()) <= 80:
        return _validation_error("Full name must be between 2 and 80 characters.")
    full_name = full_name.strip()
    if any(ord(character) < 32 for character in full_name):
        return _validation_error("Full name contains unsupported characters.")
    if not isinstance(username, str) or not USERNAME_PATTERN.fullmatch(username.strip()):
        return _validation_error("Username must be 3-32 characters using letters, numbers, or underscores.")
    username = username.strip()
    username_key = username.casefold()
    if not isinstance(password, str) or not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        return _validation_error(f"Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters.")
    if answer1 is None or answer2 is None:
        return _validation_error("Both security question answers are required (1-200 characters).")
    if phone is not None and not isinstance(phone, str):
        return _validation_error("Phone number must be text.")
    phone = phone.strip() if isinstance(phone, str) else None
    if phone == "":
        phone = None
    if phone is not None and (
        not PHONE_PATTERN.fullmatch(phone)
        or sum(character.isdigit() for character in phone) < 7
    ):
        return _validation_error("Enter a valid phone number or leave it blank.")

    password_hash = generate_password_hash(password)
    answer1_hash = generate_password_hash(answer1)
    answer2_hash = generate_password_hash(answer2)
    try:
        with connect(current_app.config["DATABASE_PATH"]) as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (
                    full_name, username, username_key, password_hash,
                    recovery_answer1_hash, recovery_answer2_hash, phone
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (full_name, username, username_key, password_hash, answer1_hash, answer2_hash, phone),
            )
            user = connection.execute(
                """
                SELECT id, full_name, username, phone, created_at,
                       (recovery_answer1_hash IS NOT NULL AND recovery_answer2_hash IS NOT NULL) AS recovery_configured
                FROM users WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
    except sqlite3.IntegrityError:
        return _validation_error("That username is already taken.", 409)

    response = jsonify({"status": "created", "user": safe_user(user)})
    response.status_code = 201
    return _no_store(response)


@auth_bp.post("/auth/login")
def login():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _validation_error("Send login details as a JSON object.")
    username = payload.get("username")
    password = payload.get("password")
    if not isinstance(username, str) or not username.strip() or len(username) > 100:
        return _validation_error("Enter your username.")
    if not isinstance(password, str) or not password or len(password) > MAX_PASSWORD_LENGTH:
        return _validation_error("Enter your password.")

    with connect(current_app.config["DATABASE_PATH"]) as connection:
        user = connection.execute(
            """
            SELECT id, full_name, username, username_key, password_hash, phone, created_at, auth_version,
                   (recovery_answer1_hash IS NOT NULL AND recovery_answer2_hash IS NOT NULL) AS recovery_configured
            FROM users WHERE username_key = ?
            """,
            (username.strip().casefold(),),
        ).fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        return _validation_error("Username or password is incorrect.", 401)

    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    session["auth_version"] = user["auth_version"]
    response = jsonify({"status": "authenticated", "user": safe_user(user)})
    return _no_store(response)


@auth_bp.post("/auth/logout")
def logout():
    session.clear()
    return _no_store(jsonify({"status": "logged_out"}))


@auth_bp.get("/auth/me")
@login_required
def me():
    return _no_store(jsonify({"user": safe_user(g.auth_user)}))


@auth_bp.post("/auth/recovery/setup")
@login_required
def setup_recovery_answers():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _validation_error("Send both recovery answers as a JSON object.")
    answer1 = _normalized_answer(payload.get("answer1"))
    answer2 = _normalized_answer(payload.get("answer2"))
    if answer1 is None or answer2 is None:
        return _validation_error("Both recovery answers are required (1-200 characters).")

    with connect(current_app.config["DATABASE_PATH"]) as connection:
        user = connection.execute(
            "SELECT recovery_answer1_hash, recovery_answer2_hash FROM users WHERE id = ?",
            (g.auth_user["id"],),
        ).fetchone()
        if user is None:
            return _validation_error("Please sign in again to continue.", 401)
        if user["recovery_answer1_hash"] and user["recovery_answer2_hash"]:
            return _validation_error("Recovery questions are already configured for this account.", 409)
        connection.execute(
            "UPDATE users SET recovery_answer1_hash = ?, recovery_answer2_hash = ? WHERE id = ?",
            (generate_password_hash(answer1), generate_password_hash(answer2), g.auth_user["id"]),
        )
    return _no_store(jsonify({"status": "configured", "message": "Recovery questions are ready for your account."}))


@auth_bp.post("/auth/recovery/questions")
def recovery_questions():
    payload = request.get_json(silent=True)
    username = payload.get("username") if isinstance(payload, dict) else None
    username_key = username.strip().casefold() if isinstance(username, str) else ""
    if not username_key or len(username_key) > 100:
        username_key = "invalid-identifier"

    with connect(current_app.config["DATABASE_PATH"]) as connection:
        limited = _rate_limited(connection, "questions", username_key, limit=12)
        user = None if limited else connection.execute(
            "SELECT recovery_answer1_hash, recovery_answer2_hash FROM users WHERE username_key = ?",
            (username_key,),
        ).fetchone()
    if user is None or not user["recovery_answer1_hash"] or not user["recovery_answer2_hash"]:
        return _no_store(jsonify({"status": "unavailable", "message": RECOVERY_GENERIC_MESSAGE}))
    return _no_store(jsonify({"status": "available", "questions": RECOVERY_QUESTIONS}))


@auth_bp.post("/auth/recovery/verify")
def verify_recovery_answers():
    payload = request.get_json(silent=True)
    username = payload.get("username") if isinstance(payload, dict) else None
    username_key = username.strip().casefold() if isinstance(username, str) else ""
    answer1 = _normalized_answer(payload.get("answer1")) if isinstance(payload, dict) else None
    answer2 = _normalized_answer(payload.get("answer2")) if isinstance(payload, dict) else None
    if not username_key or len(username_key) > 100 or answer1 is None or answer2 is None:
        return _recovery_error()

    now = int(time.time())
    with connect(current_app.config["DATABASE_PATH"]) as connection:
        limited = _rate_limited(connection, "verify", username_key, limit=5)
        user = None if limited else connection.execute(
            """
            SELECT id, recovery_answer1_hash, recovery_answer2_hash
            FROM users WHERE username_key = ?
            """,
            (username_key,),
        ).fetchone()
        if (
            user is None
            or not user["recovery_answer1_hash"]
            or not user["recovery_answer2_hash"]
            or not check_password_hash(user["recovery_answer1_hash"], answer1)
            or not check_password_hash(user["recovery_answer2_hash"], answer2)
        ):
            return _recovery_error()

        recovery_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(recovery_token.encode("utf-8")).hexdigest()
        connection.execute("DELETE FROM recovery_tokens WHERE user_id = ?", (user["id"],))
        connection.execute(
            "INSERT INTO recovery_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (token_hash, user["id"], now + RECOVERY_TOKEN_SECONDS),
        )
    response = jsonify({"status": "verified", "recovery_token": recovery_token, "expires_in": RECOVERY_TOKEN_SECONDS})
    return _no_store(response)


@auth_bp.post("/auth/recovery/reset")
def reset_password():
    payload = request.get_json(silent=True)
    username = payload.get("username") if isinstance(payload, dict) else None
    recovery_token = payload.get("recovery_token") if isinstance(payload, dict) else None
    new_password = payload.get("new_password") if isinstance(payload, dict) else None
    if not isinstance(new_password, str) or not MIN_PASSWORD_LENGTH <= len(new_password) <= MAX_PASSWORD_LENGTH:
        response = jsonify({"status": "error", "error": f"Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters."})
        response.status_code = 400
        return _no_store(response)
    if not isinstance(username, str) or not username.strip() or len(username) > 100 or not isinstance(recovery_token, str) or not 20 <= len(recovery_token) <= 200:
        return _recovery_error()

    username_key = username.strip().casefold()
    token_hash = hashlib.sha256(recovery_token.encode("utf-8")).hexdigest()
    now = int(time.time())
    password_hash = generate_password_hash(new_password)
    with connect(current_app.config["DATABASE_PATH"]) as connection:
        connection.execute("BEGIN IMMEDIATE")
        token = connection.execute(
            """
            SELECT recovery_tokens.user_id
            FROM recovery_tokens
            JOIN users ON users.id = recovery_tokens.user_id
            WHERE recovery_tokens.token_hash = ?
              AND users.username_key = ?
              AND recovery_tokens.used_at IS NULL
              AND recovery_tokens.expires_at > ?
            """,
            (token_hash, username_key, now),
        ).fetchone()
        if token is None:
            return _recovery_error()
        connection.execute(
            "UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?",
            (password_hash, token["user_id"]),
        )
        connection.execute(
            "UPDATE recovery_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
            (now, token["user_id"]),
        )
    return _no_store(jsonify({"status": "reset", "message": "Password updated. Sign in with your new password."}))
