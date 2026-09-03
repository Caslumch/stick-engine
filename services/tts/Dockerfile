# TTS somente com engine "edge" (rede, sem GPU).
# kokoro e qwen ficam de fora de proposito: exigem GPU.
FROM python:3.12-slim

WORKDIR /app
COPY requirements-vps.txt .
RUN pip install --no-cache-dir -r requirements-vps.txt

COPY server.py .

ENV TTS_ENGINES=edge
EXPOSE 5001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5001"]
