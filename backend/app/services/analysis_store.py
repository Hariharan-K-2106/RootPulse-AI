import json

from .progress_store import connect


def save_analysis(database_path, user_id, result):
    with connect(database_path) as connection:
        cursor = connection.execute(
            """
            INSERT INTO crop_analyses (
                user_id, crop_name, status, condition, candidate_condition,
                confidence, explanation, next_steps_json, model, limitations
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                result.get("crop_name", "Unknown crop"),
                result.get("status", "uncertain"),
                result.get("condition"),
                result.get("candidate_condition"),
                result.get("confidence"),
                result.get("explanation", "No explanation was provided."),
                json.dumps(result.get("next_steps") or [], ensure_ascii=False),
                result.get("model"),
                result.get("limitations"),
            ),
        )
        return cursor.lastrowid


def list_recent_analyses(database_path, user_id, limit=10):
    with connect(database_path) as connection:
        rows = connection.execute(
            """
            SELECT id, crop_name, status, condition, candidate_condition,
                   confidence, explanation, next_steps_json, model, limitations, created_at
            FROM crop_analyses
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()

    analyses = []
    for row in rows:
        try:
            next_steps = json.loads(row["next_steps_json"])
        except (TypeError, json.JSONDecodeError):
            next_steps = []
        analyses.append({
            "id": row["id"],
            "crop_name": row["crop_name"],
            "status": row["status"],
            "condition": row["condition"],
            "candidate_condition": row["candidate_condition"],
            "confidence": row["confidence"],
            "explanation": row["explanation"],
            "next_steps": next_steps,
            "model": row["model"],
            "limitations": row["limitations"],
            "created_at": row["created_at"],
        })
    return analyses
