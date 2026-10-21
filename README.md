# Test Generator

Generate multiple-choice exams from a document or a web page. Upload a PDF, DOCX,
or TXT file — or paste a URL — and the app extracts the text, sends it to an LLM on
Amazon Bedrock, and returns a multiple-choice exam you can take and self-grade in
the browser.

- **Frontend:** React + Vite (TypeScript)
- **Backend:** Python AWS Lambda behind API Gateway, run locally with AWS SAM
- **LLM:** Amazon Bedrock (Amazon Nova Lite, via the Converse API)

---

## How it works

```
Browser (React)
   │  uploads a file (base64) or a URL
   ▼
Backend  ──►  extracts text (pypdf / python-docx / BeautifulSoup)
   │          suggests a question count
   │          calls Amazon Bedrock to write the questions
   ▼
Browser renders the exam, you answer, then check your score
```

The backend exposes two endpoints:

- `POST /analyze` — extracts text and returns a suggested number of questions (no LLM call, no cost)
- `POST /generate` — extracts text and generates the exam via Bedrock

---

## Prerequisites

You need an **AWS account** with access to Amazon Bedrock, and the AWS CLI
configured locally. The backend calls Bedrock using **your** credentials, so
**running this app incurs charges on your AWS account** (Amazon Nova Lite is very
low cost, typically a fraction of a cent per exam).

### 1. Configure the AWS CLI

Install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
and configure a profile with your credentials:

```bash
aws configure
```

This creates `~/.aws/credentials` and `~/.aws/config`. Both run paths below rely
on these files — **the app never stores credentials itself.**

### 2. Make sure your IAM user/role can call Bedrock

The credentials you configure need permission to invoke Bedrock models. Attaching
the AWS-managed `AmazonBedrockFullAccess` policy is the simplest option for local
development.

### 3. Enable the model

Amazon Nova models are enabled automatically on first use in most accounts. The
default model is `us.amazon.nova-lite-v1:0` in region `us-east-1`. If you want a
different model or region, change the environment variables (see
[Configuration](#configuration)).

---

## Option A — Run with Docker (recommended)

The simplest way to run the whole stack. You only need **Docker Desktop** and a
configured AWS CLI.

### Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- AWS CLI configured (`~/.aws` must exist — it is mounted read-only into the backend container)

### Steps

From the project root:

```bash
docker compose up --build
```

Then open:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3000>

To stop:

```bash
docker compose down
```

### Notes

- The backend container mounts your `~/.aws` folder **read-only** so boto3 can
  authenticate with Bedrock. Your credentials are never copied into the image.
- The backend container runs a small Flask wrapper (`backend/hello_world/local_server.py`)
  that serves the Lambda handler over HTTP. This avoids running SAM inside Docker.
  **Flask is only used for the Docker setup — it is never deployed to AWS.**
- If your AWS profile is not named `default`, edit `AWS_PROFILE` in `docker-compose.yml`.

---

## Option B — Run natively (without Docker)

Run the frontend and backend directly on your machine. Good for active development
with hot reload.

### Requirements

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.14
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — SAM uses it to emulate the Lambda runtime locally
- AWS CLI configured

### 1. Backend

From the `backend/` folder:

```bash
sam build
sam local start-api
```

This starts the API at <http://localhost:3000>. SAM reads your `~/.aws`
credentials automatically.

> The first `sam build` downloads the Lambda base image and installs the Python
> dependencies, so it may take a couple of minutes.

### 2. Frontend

In a separate terminal, from the `frontend/` folder:

```bash
# Copy the env template and adjust if needed
# macOS / Linux:
cp .env.example .env
# Windows (PowerShell):
Copy-Item .env.example .env

npm install
npm run dev
```

Then open <http://localhost:5173>.

---

## Configuration

### Frontend (`frontend/.env`)

| Variable        | Default                 | Description                          |
| --------------- | ----------------------- | ------------------------------------ |
| `VITE_API_BASE` | `http://localhost:3000` | Base URL the frontend calls for the API |

Copy `frontend/.env.example` to `frontend/.env` to get started. The `.env` file is
git-ignored and never committed.

### Backend (environment variables)

These are set in `backend/template.yaml` (for SAM) and `docker-compose.yml` (for Docker):

| Variable         | Default                     | Description                        |
| ---------------- | --------------------------- | ---------------------------------- |
| `BEDROCK_REGION` | `us-east-1`                 | AWS region used for Bedrock calls  |
| `MODEL_ID`       | `us.amazon.nova-lite-v1:0`  | Bedrock model (inference profile)  |
| `AWS_PROFILE`    | `default`                   | AWS profile to use (Docker only)   |

---

## Project structure

```
test-generator/
├── docker-compose.yml        # Orchestrates frontend + backend for Docker
├── backend/
│   ├── Dockerfile            # Flask wrapper image (Docker only)
│   ├── template.yaml         # SAM template (API Gateway + Lambda)
│   └── hello_world/
│       ├── app.py            # Lambda handler — the real application logic
│       ├── local_server.py   # Flask wrapper for Docker (not deployed to AWS)
│       └── requirements.txt  # Python dependencies
└── frontend/
    ├── Dockerfile            # Vite dev server image
    ├── .env.example          # Template for VITE_API_BASE
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── Upload/       # File/URL upload + question config
        │   └── Exam/         # Exam rendering and grading
        └── types/exam.ts     # Shared TypeScript types
```

---

## Supported input

| Source | Formats / notes                                                        |
| ------ | ---------------------------------------------------------------------- |
| File   | PDF, DOCX, TXT                                                         |
| URL    | Public web pages. Pages behind a login or rendered entirely with JavaScript may yield little text. |

---

## Cost warning

This project calls Amazon Bedrock with your AWS credentials. You are billed for the
tokens each exam generation uses. Amazon Nova Lite is inexpensive, but the cost is
not zero. Only the `/generate` endpoint calls the model — `/analyze` runs locally
and is free.
