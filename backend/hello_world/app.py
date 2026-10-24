import json
import base64
import os
import io
import boto3
from botocore.config import Config


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


def extract_text(file_content_b64: str, file_type: str) -> str:
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


def extract_text_from_url(url: str) -> str:
    import requests
    from bs4 import BeautifulSoup

    if not url.startswith(("http://", "https://")):
        raise ValueError("URL must start with http:// or https://")

    try:
        res = requests.get(
            url,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; TestGenerator/1.0)"},
        )
        res.raise_for_status()
    except requests.RequestException as e:
        raise ValueError(f"Could not fetch the URL: {e}")

    soup = BeautifulSoup(res.text, "html.parser")

    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript"]):
        tag.decompose()

    main = soup.find("article") or soup.find("main") or soup.body or soup

    text = main.get_text(separator="\n", strip=True)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def suggest_question_count(text: str) -> int:
    word_count = len(text.split())
    if word_count < 300:
        return 5
    if word_count < 800:
        return 8
    if word_count < 2000:
        return 12
    return 15


def generate_exam(text: str, num_questions: int, num_options: int) -> list:
    model_id = os.environ.get("MODEL_ID", "us.amazon.nova-lite-v1:0")

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

    response = client.converse(
        modelId=model_id,
        messages=[
            {"role": "user", "content": [{"text": prompt}]}
        ],
        inferenceConfig={
            "maxTokens": 4096,
            "temperature": 0.3,
        },
    )

    raw_text = response["output"]["message"]["content"][0]["text"].strip()

    # Nova sometimes wraps the JSON in a markdown code fence
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    return json.loads(raw_text)


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


def extract_and_validate(body: dict) -> str:
    url = body.get("url")
    file_content = body.get("file_content")

    if url:
        text = extract_text_from_url(url)
    elif file_content:
        file_type = body.get("file_type", "").lower()
        if file_type not in ("pdf", "docx", "txt"):
            raise ValueError("file_type must be pdf, docx, or txt")
        text = extract_text(file_content, file_type)
    else:
        raise ValueError("Either 'url' or 'file_content' is required")

    if len(text.strip()) < 50:
        raise ValueError("Extracted text is too short to generate questions")

    return text


def handle_analyze(body: dict) -> dict:
    text = extract_and_validate(body)
    word_count = len(text.split())

    return response(200, {
        "word_count": word_count,
        "suggested_questions": suggest_question_count(text),
    })


def handle_generate(body: dict) -> dict:
    text = extract_and_validate(body)
    num_options = int(body.get("num_options", 4))

    if not (3 <= num_options <= 6):
        return response(400, {"error": "num_options must be between 3 and 6"})

    num_questions = body.get("num_questions")
    if num_questions is None:
        num_questions = suggest_question_count(text)
    else:
        num_questions = int(num_questions)
        if not (1 <= num_questions <= 30):
            return response(400, {"error": "num_questions must be between 1 and 30"})

    questions = generate_exam(text, num_questions, num_options)

    return response(200, {
        "questions": questions,
        "num_questions": len(questions),
        "suggested": body.get("num_questions") is None,
    })


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {})

    try:
        body = json.loads(event.get("body") or "{}")
        path = event.get("path", "")

        if path.endswith("/analyze"):
            return handle_analyze(body)

        return handle_generate(body)

    except ValueError as e:
        return response(400, {"error": str(e)})
    except Exception as e:
        print(f"Unexpected error: {e}")
        return response(500, {"error": "Internal server error"})
