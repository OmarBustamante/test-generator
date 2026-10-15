import json
import base64
import os
import io
import boto3
from botocore.config import Config


# ── Bedrock client ──────────────────────────────────────────────────────────
def get_bedrock_client():
    region = os.environ.get("BEDROCK_REGION", "us-east-1")
    return boto3.client(
        "bedrock-runtime",
        region_name=region,
        config=Config(
            connect_timeout=10,
            read_timeout=60,
            retries={"max_attempts": 2},
        ),
    )


# ── Text extraction ─────────────────────────────────────────────────────────
def extract_text(file_content_b64: str, file_type: str) -> str:
    """Decode base64 file and extract plain text depending on file type."""
    raw = base64.b64decode(file_content_b64)

    if file_type == "txt":
        return raw.decode("utf-8", errors="ignore")

    if file_type == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)

    if file_type == "docx":
        from docx import Document
        doc = Document(io.BytesIO(raw))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)

    raise ValueError(f"Unsupported file type: {file_type}")


# ── Question count suggestion ────────────────────────────────────────────────
def suggest_question_count(text: str) -> int:
    """Suggest a sensible default number of questions based on text length."""
    word_count = len(text.split())
    if word_count < 300:
        return 5
    if word_count < 800:
        return 8
    if word_count < 2000:
        return 12
    return 15


# ── Bedrock call ─────────────────────────────────────────────────────────────
def generate_exam(text: str, num_questions: int, num_options: int) -> list:
    """Call Claude via Bedrock and return a list of question objects."""
    model_id = os.environ.get("MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")

    prompt = f"""You are an expert exam writer. Based on the following text, generate {num_questions} multiple choice questions.

Rules:
- Each question must have exactly {num_options} options labeled A, B, C, D (up to F if needed).
- Only one option is correct.
- Questions must be based strictly on the provided text.
- Return ONLY a valid JSON array, no extra text or markdown.

JSON format:
[
  {{
    "question": "Question text here?",
    "options": ["A. option one", "B. option two", "C. option three", "D. option four"],
    "correct_answer": "A"
  }}
]

Text to use:
\"\"\"
{text[:12000]}
\"\"\"

Return the JSON array now:"""

    client = get_bedrock_client()

    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": [
                {"role": "user", "content": prompt}
            ],
        }),
        contentType="application/json",
        accept="application/json",
    )

    response_body = json.loads(response["body"].read())
    raw_text = response_body["content"][0]["text"].strip()

    # Strip markdown code fences if Claude wraps the JSON
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    return json.loads(raw_text)


# ── CORS helper ───────────────────────────────────────────────────────────────
def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


# ── Lambda handler ────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {})

    try:
        body = json.loads(event.get("body") or "{}")

        file_content = body.get("file_content")
        file_type = body.get("file_type", "").lower()
        num_options = int(body.get("num_options", 4))

        # Validate inputs
        if not file_content:
            return response(400, {"error": "file_content is required"})

        if file_type not in ("pdf", "docx", "txt"):
            return response(400, {"error": "file_type must be pdf, docx, or txt"})

        if not (3 <= num_options <= 6):
            return response(400, {"error": "num_options must be between 3 and 6"})

        # Extract text from the document
        text = extract_text(file_content, file_type)

        if len(text.strip()) < 50:
            return response(400, {"error": "Document text is too short to generate questions"})

        # Use user-provided count or suggest based on text length
        num_questions = body.get("num_questions")
        if num_questions is None:
            num_questions = suggest_question_count(text)
        else:
            num_questions = int(num_questions)
            if not (1 <= num_questions <= 30):
                return response(400, {"error": "num_questions must be between 1 and 30"})

        # Generate the exam
        questions = generate_exam(text, num_questions, num_options)

        return response(200, {
            "questions": questions,
            "num_questions": len(questions),
            "suggested": body.get("num_questions") is None,
        })

    except ValueError as e:
        return response(400, {"error": str(e)})
    except Exception as e:
        print(f"Unexpected error: {e}")
        return response(500, {"error": "Internal server error"})
