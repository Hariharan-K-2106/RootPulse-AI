import os
import sqlite3
from contextlib import contextmanager


@contextmanager
def connect(database_path):
    os.makedirs(os.path.dirname(database_path), exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database(database_path):
    with connect(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS crops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crop_name TEXT NOT NULL,
                field_name TEXT,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS progress_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crop_id INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
                image_filename TEXT NOT NULL UNIQUE,
                captured_at TEXT NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_progress_crop_date
                ON progress_photos(crop_id, captured_at, id);
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                username TEXT NOT NULL,
                username_key TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                recovery_answer1_hash TEXT,
                recovery_answer2_hash TEXT,
                auth_version INTEGER NOT NULL DEFAULT 0,
                phone TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS crop_analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                crop_name TEXT NOT NULL,
                status TEXT NOT NULL,
                condition TEXT,
                candidate_condition TEXT,
                confidence REAL,
                explanation TEXT NOT NULL,
                next_steps_json TEXT NOT NULL,
                model TEXT,
                limitations TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_crop_analyses_owner_date
                ON crop_analyses(user_id, created_at DESC, id DESC);
            CREATE TABLE IF NOT EXISTS recovery_tokens (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                used_at INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_recovery_tokens_user
                ON recovery_tokens(user_id, expires_at);
            CREATE TABLE IF NOT EXISTS recovery_attempts (
                bucket_key TEXT PRIMARY KEY,
                attempt_count INTEGER NOT NULL,
                window_started_at INTEGER NOT NULL
            );
            """
        )
        # Add recovery columns safely to databases created before recovery was added.
        user_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(users)").fetchall()
        }
        if "recovery_answer1_hash" not in user_columns:
            connection.execute("ALTER TABLE users ADD COLUMN recovery_answer1_hash TEXT")
        if "recovery_answer2_hash" not in user_columns:
            connection.execute("ALTER TABLE users ADD COLUMN recovery_answer2_hash TEXT")
        if "auth_version" not in user_columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0"
            )
        crop_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(crops)").fetchall()
        }
        if "user_id" not in crop_columns:
            connection.execute(
                "ALTER TABLE crops ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
            )
        unique_crop_index = False
        for index in connection.execute("PRAGMA index_list(crops)").fetchall():
            if index["unique"]:
                columns = [
                    row["name"] for row in connection.execute(
                        f"PRAGMA index_info('{index['name']}')"
                    ).fetchall()
                ]
                if columns == ["crop_name", "field_name"]:
                    unique_crop_index = True
                    break
        if unique_crop_index:
            # The original single-user schema globally constrained crop/field names.
            # Rebuild it so separate farmers can register identical crop profiles.
            connection.execute("PRAGMA foreign_keys = OFF")
            connection.execute("BEGIN")
            connection.execute(
                """
                CREATE TABLE crops_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    crop_name TEXT NOT NULL,
                    field_name TEXT,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                INSERT INTO crops_new (id, crop_name, field_name, user_id, created_at)
                SELECT id, crop_name, field_name, user_id, created_at FROM crops
                """
            )
            connection.execute("DROP TABLE crops")
            connection.execute("ALTER TABLE crops_new RENAME TO crops")
            connection.commit()
            connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_crops_user_id ON crops(user_id)"
        )
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_crops_owner_identity "
            "ON crops(user_id, crop_name, COALESCE(field_name, ''))"
        )
