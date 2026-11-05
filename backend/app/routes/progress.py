import os
import re
from datetime import date
from uuid import uuid4

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from ..auth import login_required
from ..config import MAX_IMAGE_SIZE
from ..services.crop_model import InvalidImageError, validate_image_bytes
from ..services.progress_store import connect

progress_bp = Blueprint("progress", __name__)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_CROPS = {"tomato": "Tomato", "potato": "Potato", "rice": "Rice", "maize": "Maize"}
SAFE_IMAGE_NAME = re.compile(r"^[0-9a-f]{32}\.(jpg|jpeg|png)$")


def _crop_dict(row):
    return {"id": row["id"], "crop_name": row["crop_name"], "field_name": row["field_name"], "created_at": row["created_at"]}


@progress_bp.get("/progress/crops")
@login_required
def list_crops():
    with connect(current_app.config["DATABASE_PATH"]) as connection:
        rows = connection.execute("SELECT * FROM crops WHERE user_id = ? ORDER BY created_at, id", (g.auth_user["id"],)).fetchall()
    return jsonify({"crops": [_crop_dict(row) for row in rows]})


@progress_bp.get("/progress/summary")
@login_required
def progress_summary():
    with connect(current_app.config["DATABASE_PATH"]) as connection:
        crop_totals = connection.execute(
            """
            SELECT COUNT(*) AS crop_count,
                   COUNT(DISTINCT NULLIF(TRIM(field_name), '')) AS field_count
            FROM crops WHERE user_id = ?
            """,
            (g.auth_user["id"],),
        ).fetchone()
        photo_total = connection.execute(
            """
            SELECT COUNT(*) AS photo_count
            FROM progress_photos AS photos
            JOIN crops ON crops.id = photos.crop_id
            WHERE crops.user_id = ?
            """,
            (g.auth_user["id"],),
        ).fetchone()
    return jsonify({
        "crop_count": crop_totals["crop_count"],
        "field_count": crop_totals["field_count"],
        "progress_photo_count": photo_total["photo_count"],
    })


@progress_bp.post("/progress/crops")
@login_required
def create_crop():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send crop details as a JSON object."}), 400
    crop_value = payload.get("crop_name")
    field_value = payload.get("field_name")
    if not isinstance(crop_value, str) or crop_value.strip().lower() not in ALLOWED_CROPS:
        return jsonify({"error": "Choose Tomato, Potato, Rice, or Maize."}), 400
    if field_value is not None and not isinstance(field_value, str):
        return jsonify({"error": "Field name must be text."}), 400
    field_name = (field_value or "").strip() or None
    if field_name and len(field_name) > 100:
        return jsonify({"error": "Field name must be 100 characters or fewer."}), 400
    crop_name = ALLOWED_CROPS[crop_value.strip().lower()]
    with connect(current_app.config["DATABASE_PATH"]) as connection:
        existing = connection.execute(
            "SELECT id FROM crops WHERE user_id = ? AND crop_name = ? AND field_name IS ?",
            (g.auth_user["id"], crop_name, field_name),
        ).fetchone()
        if existing:
            return jsonify({"error": "This crop and field are already in your list."}), 409
        cursor = connection.execute(
            "INSERT INTO crops (crop_name, field_name, user_id) VALUES (?, ?, ?)",
            (crop_name, field_name, g.auth_user["id"]),
        )
        row = connection.execute("SELECT * FROM crops WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"crop": _crop_dict(row)}), 201


@progress_bp.post("/progress/upload")
@login_required
def upload_progress_photo():
    crop_id = request.form.get("crop_id", "").strip()
    captured_at = request.form.get("captured_at", "").strip()
    note = request.form.get("note", "").strip() or None
    image = request.files.get("image")
    if not crop_id.isdigit():
        return jsonify({"error": "Select a crop before uploading a progress photo."}), 400
    try:
        date.fromisoformat(captured_at)
    except ValueError:
        return jsonify({"error": "Capture date must be a valid date in YYYY-MM-DD format."}), 400
    if note and len(note) > 500:
        return jsonify({"error": "Notes must be 500 characters or fewer."}), 400
    if image is None or not image.filename:
        return jsonify({"error": "Choose a progress photo to upload."}), 400
    extension = os.path.splitext(secure_filename(image.filename))[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Upload a JPG, JPEG, or PNG image."}), 415
    image_bytes = image.stream.read(MAX_IMAGE_SIZE + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE:
        return jsonify({"error": "The image must be 10 MB or smaller."}), 413
    if not image_bytes:
        return jsonify({"error": "The selected image is empty."}), 400
    try:
        validate_image_bytes(image_bytes)
    except InvalidImageError as error:
        return jsonify({"error": str(error)}), 400

    database_path = current_app.config["DATABASE_PATH"]
    with connect(database_path) as connection:
        crop = connection.execute("SELECT id FROM crops WHERE id = ? AND user_id = ?", (int(crop_id), g.auth_user["id"])).fetchone()
        if crop is None:
            return jsonify({"error": "That crop could not be found. Refresh the crop list and try again."}), 404
        filename = secure_filename(f"{uuid4().hex}{extension}")
        upload_folder = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_folder, exist_ok=True)
        image_path = os.path.join(upload_folder, filename)
        with open(image_path, "xb") as stored_image:
            stored_image.write(image_bytes)
        cursor = connection.execute(
            "INSERT INTO progress_photos (crop_id, image_filename, captured_at, note) VALUES (?, ?, ?, ?)",
            (int(crop_id), filename, captured_at, note),
        )
        row = connection.execute("SELECT * FROM progress_photos WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"photo": _photo_dict(row), "message": "Progress photo saved."}), 201


def _photo_dict(row):
    return {
        "id": row["id"],
        "crop_id": row["crop_id"],
        "captured_at": row["captured_at"],
        "note": row["note"],
        "image_url": f"/api/progress/images/{row['image_filename']}",
        "created_at": row["created_at"],
        "analysis": None,
    }


@progress_bp.get("/progress/<int:crop_id>")
@login_required
def list_progress_photos(crop_id):
    with connect(current_app.config["DATABASE_PATH"]) as connection:
        if connection.execute("SELECT id FROM crops WHERE id = ? AND user_id = ?", (crop_id, g.auth_user["id"])).fetchone() is None:
            return jsonify({"error": "Crop not found."}), 404
        rows = connection.execute(
            "SELECT * FROM progress_photos WHERE crop_id = ? ORDER BY captured_at ASC, id ASC",
            (crop_id,),
        ).fetchall()
    return jsonify({"photos": [_photo_dict(row) for row in rows]})


@progress_bp.get("/progress/images/<filename>")
@login_required
def get_progress_image(filename):
    if not SAFE_IMAGE_NAME.fullmatch(filename):
        return jsonify({"error": "Image not found."}), 404
    with connect(current_app.config["DATABASE_PATH"]) as connection:
        exists = connection.execute(
            """
            SELECT 1
            FROM progress_photos AS photos
            JOIN crops ON crops.id = photos.crop_id
            WHERE photos.image_filename = ? AND crops.user_id = ?
            """,
            (filename, g.auth_user["id"]),
        ).fetchone()
    if exists is None or not os.path.isfile(os.path.join(current_app.config["UPLOAD_FOLDER"], filename)):
        return jsonify({"error": "Image not found."}), 404
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename, mimetype="image/" + filename.rsplit(".", 1)[1])
