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

import os
import asyncio
import glob
import json
import os
import time
import threading
import queue

import numpy as np
import sounddevice as sd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openwakeword.model import Model as OWWModel

# ─── Config ──────────────────────────────────────────────────

SAMPLE_RATE = 16000
CHUNK_SAMPLES = 1280  # 80ms chunks (OpenWakeWord expects 80ms)
THRESHOLD = 0.5       # Detection confidence threshold


def _load_input_device():
    """
    Indice do microfone. None = padrao do Windows, que nem sempre e o que capta voz.
    Ordem: env WAKEWORD_DEVICE > arquivo services/wakeword/device.txt > padrao.
    Liste os indices com:
      services/wakeword/.venv/Scripts/python.exe -m sounddevice
    """
    raw = os.environ.get("WAKEWORD_DEVICE")
    if not raw:
        path = os.path.join(os.path.dirname(__file__), "device.txt")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                # ignora comentarios e linhas vazias
                raw = next(
                    (l.strip() for l in fh if l.strip() and not l.strip().startswith("#")),
                    None,
                )
    try:
        return int(raw) if raw else None
    except ValueError:
        print(f"[WakeWord] WAKEWORD_DEVICE invalido: {raw!r} — usando o padrao")
        return None


INPUT_DEVICE = _load_input_device()
COOLDOWN_SECS = 3.0   # Ignore detections for N seconds after a trigger

# ─── State ───────────────────────────────────────────────────

oww_model: OWWModel | None = None
connected_clients: set[WebSocket] = set()
is_listening = False
listen_thread: threading.Thread | None = None
stop_event = threading.Event()

# Thread-safe queue for detections
detection_queue: queue.Queue = queue.Queue()


def load_model():
    """Load OpenWakeWord model (downloads on first run)."""
    global oww_model
    if oww_model is not None:
        return

    # Carregar modelo customizado se existir, senão usa hey_jarvis
    import glob
    custom_models = glob.glob(os.path.join(os.path.dirname(__file__), "*.onnx"))

    if custom_models:
        print(f"[WakeWord] Loading custom model(s): {[os.path.basename(m) for m in custom_models]}")
        oww_model = OWWModel(
            wakeword_models=custom_models,
            inference_framework="onnx",
        )
    else:
        print("[WakeWord] No custom model found, using default 'hey_jarvis'")
        oww_model = OWWModel(
            wakeword_models=["hey_jarvis"],
            inference_framework="onnx",
        )
    print(f"[WakeWord] Model loaded. Wake words: {list(oww_model.models.keys())}")


# ─── Audio capture + detection loop ─────────────────────────

def detection_loop():
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
        oww_model.predict(audio)

        # Check all model outputs
        for model_name, scores in oww_model.prediction_buffer.items():
            if len(scores) == 0:
                continue
            score = scores[-1]
            now = time.time()

            if score >= THRESHOLD and (now - last_detection) > COOLDOWN_SECS:
                last_detection = now
                print(f"[WakeWord] Detected '{model_name}' (confidence: {score:.3f})")

                # Put detection in thread-safe queue
                detection_queue.put({
                    "event": "wake_word_detected",
                    "model": model_name,
                    "confidence": round(float(score), 3),
                    "timestamp": now,
                })

    try:
        # WAKEWORD_DEVICE: indice do dispositivo de entrada (ver `python -m sounddevice`).
        # Sem isso o Windows entrega o padrao do sistema, que pode ser um mic mudo.
        try:
            dev_name = sd.query_devices(INPUT_DEVICE if INPUT_DEVICE is not None else sd.default.device[0])["name"]
        except Exception:
            dev_name = "?"
        print(f"[WakeWord] Entrada de audio: [{INPUT_DEVICE if INPUT_DEVICE is not None else 'padrao'}] {dev_name}")

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            blocksize=CHUNK_SAMPLES,
            callback=audio_callback,
            device=INPUT_DEVICE,
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


async def broadcast_loop():
    """Async loop that drains the detection queue and broadcasts to WS clients."""
    while True:
        try:
            # Non-blocking check
            detection = detection_queue.get_nowait()
            msg = json.dumps(detection)
            print(f"[WakeWord] Broadcasting to {len(connected_clients)} client(s)")

            disconnected = set()
            for ws in connected_clients:
                try:
                    await ws.send_text(msg)
                except Exception:
                    disconnected.add(ws)

            connected_clients.difference_update(disconnected)
        except queue.Empty:
            pass

        await asyncio.sleep(0.05)  # 50ms poll


def start_listening():
    """Start the detection loop in a background thread."""
    global listen_thread

    if listen_thread and listen_thread.is_alive():
        return

    stop_event.clear()
    listen_thread = threading.Thread(target=detection_loop, daemon=True)
    listen_thread.start()


def stop_listening():
    """Stop the detection loop."""
    stop_event.set()
    if listen_thread:
        listen_thread.join(timeout=3)


# ─── FastAPI ─────────────────────────────────────────────────

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_listening()
    # Start the broadcast loop as a background task
    task = asyncio.create_task(broadcast_loop())
    yield
    stop_listening()
    task.cancel()


app = FastAPI(title="Jarvis Wake Word", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "listening": is_listening,
        "model": list(oww_model.models.keys()) if oww_model else "not_loaded",
        "threshold": THRESHOLD,
        "clients": len(connected_clients),
    }


@app.post("/start")
async def start():
    start_listening()
    return {"status": "listening"}


@app.post("/stop")
async def stop():
    stop_listening()
    return {"status": "stopped"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    print(f"[WakeWord] Client connected ({len(connected_clients)} total)")

    try:
        await ws.send_text(json.dumps({
            "event": "connected",
            "listening": is_listening,
            "model": list(oww_model.models.keys()) if oww_model else "not_loaded",
        }))

        # Keep connection alive
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
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
