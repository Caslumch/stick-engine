"""
Servidor TTS multi-engine para Jarvis.
Roda em localhost:5001.

Engines disponíveis:
  - piper:  rápido (~100ms), qualidade ok, local, CPU
  - edge:   rápido (~500ms), qualidade muito boa, requer internet
  - kokoro: médio (~1-2s GPU), qualidade boa, local
  - qwen:   lento (~30-100s), qualidade excelente, local, GPU

Uso:
  pip install -r requirements.txt
  python server.py
"""

import io
import struct
import time
import asyncio
import tempfile
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="Jarvis TTS")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Models (lazy loaded) ─────────────────────────────────────

qwen_model = None
kokoro_pipeline = None


class SpeakRequest(BaseModel):
    text: str
    engine: str = "edge"  # piper | edge | kokoro | qwen
    language: str = "Portuguese"
    voice: str = ""  # vazio = usar padrão do engine


# ─── Encode WAV ───────────────────────────────────────────────

def encode_wav(samples, sample_rate: int) -> bytes:
    import numpy as np
    audio = samples.flatten() if hasattr(samples, 'flatten') else np.array(samples).flatten()
    if audio.dtype in (np.float32, np.float64):
        audio = (audio * 32767).clip(-32768, 32767).astype(np.int16)
    raw = audio.tobytes()
    data_size = len(raw)

    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * 2))
    buf.write(struct.pack("<H", 2))
    buf.write(struct.pack("<H", 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(raw)
    return buf.getvalue()


# ─── Engine: Edge TTS ─────────────────────────────────────────

async def speak_edge(text: str, voice: str) -> bytes:
    import edge_tts

    voice = voice or "pt-BR-AntonioNeural"  # Masculina natural pt-BR
    communicate = edge_tts.Communicate(text, voice)

    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])

    return buf.getvalue()  # Já é MP3, browser decodifica direto


# ─── Engine: Kokoro ───────────────────────────────────────────

async def speak_kokoro(text: str, voice: str) -> bytes:
    global kokoro_pipeline

    if kokoro_pipeline is None:
        print("[Kokoro] Carregando modelo...")
        from kokoro import KPipeline
        kokoro_pipeline = KPipeline(lang_code="p")  # português
        print("[Kokoro] Pronto")

    voice = voice or "pf_dora"  # Voz feminina pt-BR
    generator = kokoro_pipeline(text, voice=voice)

    import numpy as np
    all_audio = []
    for _, _, audio in generator:
        all_audio.append(audio)

    if not all_audio:
        raise ValueError("Kokoro não gerou áudio")

    combined = np.concatenate(all_audio)
    return encode_wav(combined, 24000)


# ─── Engine: Qwen3-TTS ───────────────────────────────────────

async def speak_qwen(text: str, voice: str) -> bytes:
    global qwen_model

    if qwen_model is None:
        print("[Qwen] Carregando modelo...")
        from qwen_tts import Qwen3TTSModel
        qwen_model = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice")
        print("[Qwen] Pronto")

    voice = voice or "ryan"
    wavs, sr = qwen_model.generate_custom_voice(
        text=text,
        language="Portuguese",
        speaker=voice,
    )
    audio = wavs[0]
    if hasattr(audio, "cpu"):
        audio = audio.cpu().numpy()
    return encode_wav(audio, sr)


# ─── Routes ───────────────────────────────────────────────────

@app.post("/speak")
async def speak(req: SpeakRequest):
    t0 = time.time()
    engine = req.engine.lower()

    try:
        if engine == "edge":
            audio_bytes = await speak_edge(req.text, req.voice)
            content_type = "audio/mpeg"  # Edge retorna MP3
        elif engine == "kokoro":
            audio_bytes = await speak_kokoro(req.text, req.voice)
            content_type = "audio/wav"
        elif engine == "qwen":
            audio_bytes = await speak_qwen(req.text, req.voice)
            content_type = "audio/wav"
        else:
            return Response(content=f"Engine desconhecido: {engine}", status_code=400)

        elapsed = time.time() - t0
        print(f"[{engine}] '{req.text[:50]}...' -> {len(audio_bytes)} bytes, {elapsed:.2f}s")

        return Response(
            content=audio_bytes,
            media_type=content_type,
            headers={"X-Duration": str(elapsed), "X-Engine": engine},
        )
    except Exception as e:
        print(f"[{engine}] Erro: {e}")
        import traceback
        traceback.print_exc()
        return Response(content=str(e), status_code=500)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "engines": ["edge", "kokoro", "qwen", "piper"],
        "ready": True,
    }


@app.get("/engines")
async def engines():
    """Lista engines disponíveis com metadados."""
    return [
        {
            "id": "piper",
            "name": "Piper",
            "description": "Rápido, local, CPU",
            "latency": "~100ms",
            "quality": "Ok",
            "local": True,
            "voices": ["pt_BR-faber-medium"],
        },
        {
            "id": "edge",
            "name": "Edge TTS",
            "description": "Neural Microsoft, requer internet",
            "latency": "~500ms",
            "quality": "Muito boa",
            "local": False,
            "voices": [
                "pt-BR-AntonioNeural",
                "pt-BR-FranciscaNeural",
                "pt-BR-ThalitaNeural",
                "pt-BR-GiovannaNeural",
            ],
        },
        {
            "id": "kokoro",
            "name": "Kokoro",
            "description": "Natural, local, GPU",
            "latency": "~1-2s",
            "quality": "Boa",
            "local": True,
            "voices": ["pf_dora", "pm_alex", "pm_santa"],
        },
        {
            "id": "qwen",
            "name": "Qwen3-TTS",
            "description": "Excelente qualidade, lento, GPU",
            "latency": "~30-100s",
            "quality": "Excelente",
            "local": True,
            "voices": ["aiden", "dylan", "eric", "ryan", "serena", "vivian"],
        },
    ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
