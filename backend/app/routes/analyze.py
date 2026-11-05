import os

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..config import MAX_IMAGE_SIZE
from ..services.crop_model import (
    InvalidImageError,
    ModelUnavailableError,
    analyze_leaf,
    validate_image_bytes,
)
from ..services.analysis_store import list_recent_analyses, save_analysis

analyze_bp = Blueprint("analyze", __name__)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_CROPS = {"tomato", "potato", "rice", "maize"}
SUPPORTED_CROPS = {"tomato", "potato", "maize"}


@analyze_bp.get("/analyze/recent")
@login_required
def recent_analyses():
    analyses = list_recent_analyses(
        current_app.config["DATABASE_PATH"],
        g.auth_user["id"],
        limit=10,
    )
    return jsonify({"analyses": analyses})


def _save_result(result):
    analysis_id = save_analysis(
        current_app.config["DATABASE_PATH"],
        g.auth_user["id"],
        result,
    )
    return jsonify({**result, "analysis_id": analysis_id}), 200


@analyze_bp.post("/analyze")
@login_required
def analyze_crop():
    crop_name = request.form.get("crop_name", "").strip()
    image = request.files.get("image")

    if not crop_name:
        return jsonify({"status": "error", "message": "Please select a crop."}), 400
    if crop_name.lower() not in ALLOWED_CROPS:
        return jsonify({"status": "error", "message": "Choose a supported crop name."}), 400
    if image is None or not image.filename:
        return jsonify({"status": "error", "message": "Please upload a crop image."}), 400

    extension = os.path.splitext(image.filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"status": "error", "message": "Upload a JPG, JPEG, or PNG image."}), 415

    image_bytes = image.stream.read(MAX_IMAGE_SIZE + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE:
        return jsonify({"status": "error", "message": "The image must be 10 MB or smaller."}), 413
    if not image_bytes:
        return jsonify({"status": "error", "message": "The selected image is empty."}), 400

    try:
        validate_image_bytes(image_bytes)
    except InvalidImageError as error:
        return jsonify({"status": "error", "message": str(error)}), 400

    if crop_name.lower() not in SUPPORTED_CROPS:
        result = {
            "status": "unsupported_crop",
            "crop_name": crop_name.title(),
            "condition": None,
            "candidate_condition": None,
            "confidence": None,
            "explanation": "This model currently supports tomato, potato, and maize leaf images. Rice is not included.",
            "next_steps": ["Select tomato, potato, or maize to use this model."],
            "limitations": "Only the supported PlantVillage crop classes are analyzed.",
        }
        return _save_result(result)

    try:
        result = analyze_leaf(
            image_bytes=image_bytes,
            crop_name=crop_name,
            repo_id=current_app.config["CROP_MODEL_REPO"],
            revision=current_app.config["CROP_MODEL_REVISION"],
            cache_dir=current_app.config["MODEL_CACHE_DIR"],
            min_score=current_app.config["CROP_MODEL_MIN_SCORE"],
            min_margin=current_app.config["CROP_MODEL_MIN_MARGIN"],
        )
    except InvalidImageError as error:
        return jsonify({"status": "error", "message": str(error)}), 400
    except ModelUnavailableError as error:
        return jsonify({"status": "model_unavailable", "message": str(error)}), 503

    return _save_result(result)
