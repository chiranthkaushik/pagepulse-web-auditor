"""
Page Pulse - Web Analysis Flask Application.
Serves frontend UI and REST API endpoint for auditing webpage performance and SEO metadata.
"""

import os
from typing import Tuple, Union
from flask import Flask, jsonify, render_template, request, Response
from services.analyzer import AnalysisError, analyze_url

app = Flask(__name__, static_folder="static", template_folder="templates")


@app.route("/")
def index() -> str:
    """Renders the primary application user interface."""
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def health_check() -> Tuple[Response, int]:
    """Health check endpoint for deployment monitoring."""
    return jsonify({"status": "healthy", "service": "Page Pulse API"}), 200


@app.route("/api/analyze", methods=["POST"])
def api_analyze() -> Tuple[Response, int]:
    """
    POST /api/analyze
    Analyzes target website URL and returns webpage metrics.

    Request JSON:
        {"url": "https://example.com"}

    Success Response JSON (200):
        {
            "status": 200,
            "response_time_ms": 153,
            "page_title": "Example Domain",
            "meta_description": "...",
            "h1_count": 3,
            "image_count": 14,
            "word_count": 1285
        }

    Error Response JSON:
        {
            "error": "Error description message",
            "status": 400
        }
    """
    try:
        data = request.get_json(silent=True)
        if data is None or not isinstance(data, dict):
            return jsonify({
                "error": "Invalid request payload. Expected JSON object.",
                "status": 400
            }), 400

        target_url = data.get("url")
        if not target_url or not str(target_url).strip():
            return jsonify({
                "error": "URL parameter 'url' is required.",
                "status": 400
            }), 400

        # Perform analysis
        analysis_result = analyze_url(raw_url=str(target_url).strip())
        return jsonify(analysis_result), 200

    except AnalysisError as e:
        response_data = {
            "error": e.message,
            "status": e.status_code
        }
        if e.title:
            response_data["title"] = e.title
        return jsonify(response_data), e.status_code

    except Exception as e:
        # Catch unexpected errors to ensure backend NEVER crashes
        return jsonify({
            "error": f"An unexpected server error occurred: {str(e)}",
            "status": 500
        }), 500


if __name__ == "__main__":
    # Retrieve port from environment, defaulting to 3000 for AI Studio / Cloud Run compatibility
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=False)
