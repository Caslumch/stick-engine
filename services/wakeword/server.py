"""
Servidor Wake Word para Jarvis.
Roda em localhost:5002.

Usa OpenWakeWord para detecção local/offline de "hey jarvis".
Captura áudio do microfone do sistema e emite eventos via WebSocket
quando a wake word é detectada.

Uso:
  pip install -r requirements.txt
  python server.py
"""

import asyncio
import json
import time
import threading
from contextlib import asynccontextmanager

import numpy as np
import sounddevice as sd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openwakeword.model import Model as OWWModel

# ─── Config ──────────────────────────────────────────────────

SAMPLE_RATE = 16000
CHUNK_SAMPLES = 1280  # 80ms chunks (OpenWakeWord expects 80ms)
THRESHOLD = 0.5       # Detection confidence threshold
COOLDOWN_SECS = 3.0   # Ignore detections for N seconds after a trigger
REFRACTORY_SECS = 0.5 # Min time between checks

# ─── State ───────────────────────────────────────────────────

oww_model: OWWModel | None = None
connected_clients: set[WebSocket] = set()
is_listening = False
listen_thread: threading.Thread | None = None
stop_event = threading.Event()


def load_model():
    """Load OpenWakeWord model (downloads on first run)."""
    global oww_model
    if oww_model is not None:
        return

    print("[WakeWord] Loading OpenWakeWord model...")
    oww_model = OWWModel(
        wakeword_models=["hey_jarvis"],
        inference_framework="onnx",
    )
    print(f"[WakeWord] Model loaded. Wake words: {list(oww_model.models.keys())}")


# ─── Audio capture + detection loop ─────────────────────────

def detection_loop(loop: asyncio.AbstractEventLoop):
    """Runs in a background thread. Captures mic audio and runs inference."""
    global is_listening

    load_model()
    assert oww_model is not None

    last_detection = 0.0
    is_listening = True

    print("[WakeWord] Listening started...")

    def audio_callback(indata, frames, time_info, status):
        nonlocal last_detection

        if stop_event.is_set():
            raise sd.CallbackAbort

        # Convert to int16 as expected by OWW
        audio = (indata[:, 0] * 32767).astype(np.int16)

        # Run prediction
        prediction = oww_model.predict(audio)

        # Check all model outputs
        for model_name, scores in oww_model.prediction_buffer.items():
            if len(scores) == 0:
                continue
            score = scores[-1]
            now = time.time()

            if score >= THRESHOLD and (now - last_detection) > COOLDOWN_SECS:
                last_detection = now
                print(f"[WakeWord] Detected '{model_name}' (confidence: {score:.3f})")

                # Notify connected clients
                asyncio.run_coroutine_threadsafe(
                    broadcast_detection(model_name, score),
                    loop,
                )

    try:
        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            blocksize=CHUNK_SAMPLES,
            callback=audio_callback,
        ):
            while not stop_event.is_set():
                stop_event.wait(0.1)
    except sd.CallbackAbort:
        pass
    except Exception as e:
        print(f"[WakeWord] Audio error: {e}")
    finally:
        is_listening = False
        print("[WakeWord] Listening stopped.")


async def broadcast_detection(model_name: str, confidence: float):
    """Send detection event to all connected WebSocket clients."""
    msg = json.dumps({
        "event": "wake_word_detected",
        "model": model_name,
        "confidence": round(confidence, 3),
        "timestamp": time.time(),
    })

    disconnected = set()
    for ws in connected_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            disconnected.add(ws)

    connected_clients.difference_update(disconnected)


def start_listening(loop: asyncio.AbstractEventLoop):
    """Start the detection loop in a background thread."""
    global listen_thread

    if listen_thread and listen_thread.is_alive():
        return

    stop_event.clear()
    listen_thread = threading.Thread(target=detection_loop, args=(loop,), daemon=True)
    listen_thread.start()


def stop_listening():
    """Stop the detection loop."""
    stop_event.set()
    if listen_thread:
        listen_thread.join(timeout=3)


# ─── FastAPI ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    start_listening(loop)
    yield
    stop_listening()


app = FastAPI(title="Jarvis Wake Word", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "listening": is_listening,
        "model": "hey_jarvis",
        "threshold": THRESHOLD,
        "clients": len(connected_clients),
    }


@app.post("/start")
async def start():
    """Start listening for wake word."""
    loop = asyncio.get_event_loop()
    start_listening(loop)
    return {"status": "listening"}


@app.post("/stop")
async def stop():
    """Stop listening for wake word."""
    stop_listening()
    return {"status": "stopped"}


@app.post("/threshold")
async def set_threshold(value: float):
    """Adjust detection threshold (0.0 - 1.0)."""
    global THRESHOLD
    THRESHOLD = max(0.1, min(1.0, value))
    return {"threshold": THRESHOLD}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint for real-time wake word notifications."""
    await ws.accept()
    connected_clients.add(ws)
    print(f"[WakeWord] Client connected ({len(connected_clients)} total)")

    try:
        # Send initial status
        await ws.send_text(json.dumps({
            "event": "connected",
            "listening": is_listening,
            "model": "hey_jarvis",
        }))

        # Keep connection alive, handle control messages
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "start":
                    loop = asyncio.get_event_loop()
                    start_listening(loop)
                    await ws.send_text(json.dumps({"event": "status", "listening": True}))
                elif msg.get("action") == "stop":
                    stop_listening()
                    await ws.send_text(json.dumps({"event": "status", "listening": False}))
                elif msg.get("action") == "ping":
                    await ws.send_text(json.dumps({"event": "pong"}))
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)
        print(f"[WakeWord] Client disconnected ({len(connected_clients)} total)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
