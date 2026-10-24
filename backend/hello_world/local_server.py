"""
Local development server for Docker.

Wraps the Lambda handler with Flask so the container can serve real HTTP
requests without SAM or Docker-in-Docker. Only used for the local Docker
setup — it is never deployed to AWS Lambda.
"""
from flask import Flask, request, Response

from app import lambda_handler

flask_app = Flask(__name__)


def build_event(path: str):
    return {
        "httpMethod": request.method,
        "path": path,
        "body": request.get_data(as_text=True) or "{}",
        "headers": dict(request.headers),
    }


def proxy(path: str):
    event = build_event(path)
    result = lambda_handler(event, None)

    return Response(
        response=result.get("body", ""),
        status=result.get("statusCode", 200),
        headers=result.get("headers", {}),
        mimetype="application/json",
    )


@flask_app.route("/analyze", methods=["POST", "OPTIONS"])
def analyze():
    return proxy("/analyze")


@flask_app.route("/generate", methods=["POST", "OPTIONS"])
def generate():
    return proxy("/generate")


if __name__ == "__main__":
    flask_app.run(host="0.0.0.0", port=3000)
