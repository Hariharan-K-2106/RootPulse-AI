import json
import logging
import os
from functools import lru_cache
from io import BytesIO

import numpy as np
from PIL import Image, UnidentifiedImageError

MODEL_WEIGHTS = "efficientnet_v2_s_best.onnx"
MODEL_DATA = "efficientnet_v2_s_best.onnx.data"
CLASS_MAP = "classes.json"
MODEL_NAME = "PlantVillage EfficientNetV2-S"


class ModelUnavailableError(Exception):
    """Raised when the model weights or CPU inference runtime cannot be loaded."""


class InvalidImageError(Exception):
    """Raised when an uploaded file is not a readable image."""


def validate_image_bytes(image_bytes: bytes) -> None:
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            source.verify()
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise InvalidImageError("The uploaded file is not a readable image.") from error


@lru_cache(maxsize=2)
def _load_model(repo_id: str, revision: str, cache_dir: str):
    try:
        os.makedirs(cache_dir, exist_ok=True)
        # Keep Hugging Face Hub and Xet logs/chunks inside this project-owned cache.
        os.environ["HF_HOME"] = cache_dir
        os.environ["HF_HUB_CACHE"] = os.path.join(cache_dir, "hub")
        os.environ["HF_XET_CACHE"] = os.path.join(cache_dir, "xet")
        import onnxruntime as ort
        from huggingface_hub import hf_hub_download

        model_path = hf_hub_download(repo_id=repo_id, filename=MODEL_WEIGHTS, revision=revision, cache_dir=cache_dir)
        # EfficientNet weights are stored as ONNX external data beside the graph.
        hf_hub_download(repo_id=repo_id, filename=MODEL_DATA, revision=revision, cache_dir=cache_dir)
        classes_path = hf_hub_download(repo_id=repo_id, filename=CLASS_MAP, revision=revision, cache_dir=cache_dir)
        with open(classes_path, "r", encoding="utf-8") as class_file:
            class_data = json.load(class_file)
        if isinstance(class_data, dict) and "classes" in class_data:
            classes = class_data["classes"]
        elif isinstance(class_data, list):
            classes = class_data
        else:
            raise ValueError("Unsupported class map format")
        if not classes:
            raise ValueError("Model class map is empty")
        session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        return session, classes
    except Exception as error:
        logging.getLogger(__name__).warning(
            "Crop analysis model could not be loaded (%s).", type(error).__name__
        )
        raise ModelUnavailableError(
            "The crop analysis model is unavailable. Check the model download and try again."
        ) from error


def _crop_key(label: str) -> str:
    crop = label.split("___", 1)[0].lower().replace("_", " ")
    if "corn" in crop or "maize" in crop:
        return "maize"
    for crop_name in ("tomato", "potato", "rice"):
        if crop_name in crop:
            return crop_name
    return crop.strip()


def _condition_name(label: str) -> str:
    condition = label.split("___", 1)[-1]
    return " ".join(condition.replace("_", " ").split()).strip().title()


def _classify_scope(label: str, selected_crop: str, confidence: float, margin: float, min_score: float, min_margin: float):
    condition = _condition_name(label)
    predicted_crop = _crop_key(label)
    if predicted_crop != selected_crop.lower():
        return {
            "status": "uncertain",
            "condition": None,
            "candidate_condition": condition,
            "explanation": (
                f"The model's closest class was {condition} for a different crop than the "
                f"selected {selected_crop}. This result is marked uncertain."
            ),
        }
    if confidence < min_score or margin < min_margin:
        return {
            "status": "uncertain",
            "condition": None,
            "candidate_condition": condition,
            "explanation": (
                "The model did not clearly distinguish this image from its other classes. "
                "Treat the closest match as uncertain."
            ),
        }
    healthy = "healthy" in condition.lower()
    return {
        "status": "healthy" if healthy else "possible_issue",
        "condition": "Healthy leaf" if healthy else condition,
        "candidate_condition": None,
        "explanation": (
            f"The selected class received a raw model score of {confidence * 100:.1f}%. "
            "This score is not a calibrated probability of diagnosis."
        ),
    }


def analyze_leaf(image_bytes: bytes, crop_name: str, repo_id: str, revision: str, cache_dir: str, min_score: float, min_margin: float):
    validate_image_bytes(image_bytes)
    with Image.open(BytesIO(image_bytes)) as source:
        image = source.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)

    session, classes = _load_model(repo_id, revision, cache_dir)
    pixels = np.asarray(image, dtype=np.float32) / 255.0
    mean = np.asarray([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
    tensor = np.transpose((pixels - mean) / std, (2, 0, 1))[None, ...].astype(np.float32)
    input_name = session.get_inputs()[0].name
    logits = np.asarray(session.run(None, {input_name: tensor})[0]).reshape(-1)
    if logits.size != len(classes) or logits.size < 2:
        raise ModelUnavailableError("The loaded model returned an unexpected result.")

    shifted = logits - np.max(logits)
    probabilities = np.exp(shifted)
    probabilities /= probabilities.sum()
    top_indices = np.argsort(probabilities)[::-1][:2]
    top_index = int(top_indices[0])
    confidence = float(probabilities[top_index])
    margin = confidence - float(probabilities[int(top_indices[1])])
    classification = _classify_scope(
        str(classes[top_index]), crop_name, confidence, margin, min_score, min_margin
    )

    if classification["status"] == "healthy":
        next_steps = [
            "Continue to monitor the crop as it grows.",
            "If symptoms appear, photograph a single leaf in daylight and ask a local extension expert to confirm.",
        ]
    elif classification["status"] == "possible_issue":
        next_steps = [
            "Photograph a few leaves in daylight to compare visible symptoms.",
            "Ask a local agronomist or extension expert to confirm before treating the crop.",
        ]
    else:
        next_steps = [
            "Try a clear, well-lit photo of one leaf against a plain background.",
            "Confirm visible symptoms with a local agronomist or extension expert.",
        ]

    return {
        **classification,
        "crop_name": crop_name.title(),
        "confidence": round(confidence * 100, 1),
        "model": MODEL_NAME,
        "next_steps": next_steps,
        "limitations": (
            "This model was trained on PlantVillage leaf images with plain backgrounds. "
            "Its field performance and ability to reject non-leaf photos have not been validated."
        ),
    }
