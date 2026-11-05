import logging

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

load_dotenv()

from .config import Config
from .routes.analyze import analyze_bp
from .routes.auth import auth_bp
from .routes.chat import chat_bp
from .routes.health import health_bp
from .routes.irrigation import irrigation_bp
from .routes.progress import progress_bp
from .services.progress_store import initialize_database


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    initialize_database(app.config["DATABASE_PATH"])
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(analyze_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(irrigation_bp, url_prefix="/api")
    app.register_blueprint(progress_bp, url_prefix="/api")

    @app.errorhandler(413)
    def upload_too_large(_error):
        return jsonify({"status": "error", "message": "The upload is too large. The image must be 10 MB or smaller."}), 413

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error("Unhandled server error: %s", error)
        return jsonify({"error": "Internal server error"}), 500

    logging.basicConfig(level=logging.INFO)
    return app
