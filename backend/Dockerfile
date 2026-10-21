FROM python:3.13-slim

WORKDIR /app

COPY hello_world/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY hello_world/ ./hello_world

WORKDIR /app/hello_world

EXPOSE 3000

CMD ["python", "local_server.py"]