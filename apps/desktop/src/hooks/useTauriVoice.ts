import { useRef, useCallback, useEffect, useState } from 'react'

/**
 * Hook que usa Whisper (STT) e Piper (TTS) via Tauri sidecars.
 * Fallback automático pra Web Speech API quando rodando no browser.
 *
 * STT: grava áudio com MediaRecorder, envia WAV base64 pro Tauri,
 * recebe transcrição do Whisper.
 *
 * TTS: envia texto pro Tauri, recebe WAV base64 do Piper,
 * reproduz via AudioContext.
 */

// Verificar se estamos dentro do Tauri
const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Import dinâmico do Tauri (só carrega se disponível)
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export interface TauriVoiceState {
  /** Se os sidecars estão disponíveis */
  ready: boolean
  /** Se está usando Tauri (true) ou Web Speech API fallback (false) */
  native: boolean
}

export interface TauriSTTCallbacks {
  onResult?: (text: string) => void
  onError?: (error: string) => void
}

export interface TauriTTSCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

// ─── STT (Whisper via Tauri) ─────────────────────────────────

export function useTauriSTT(callbacks: TauriSTTCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(250) // chunks a cada 250ms
    } catch (err) {
      cbRef.current.onError?.(`Erro ao acessar microfone: ${err}`)
    }
  }, [])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        // Parar tracks do mic
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        // Converter chunks para WAV base64
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        try {
          // Converter webm para WAV usando AudioContext
          const arrayBuffer = await blob.arrayBuffer()
          const audioCtx = new AudioContext({ sampleRate: 16000 })
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

          // Encode como WAV 16-bit PCM
          const wavBuffer = encodeWav(audioBuffer)
          const base64 = arrayBufferToBase64(wavBuffer)
          await audioCtx.close()

          // Enviar pro Whisper via Tauri
          const text = await tauriInvoke<string>('transcribe', { audioB64: base64 })
          if (text.trim()) {
            cbRef.current.onResult?.(text.trim())
          }
        } catch (err) {
          cbRef.current.onError?.(`Erro na transcrição: ${err}`)
        }

        resolve()
      }

      recorder.stop()
    })
  }, [])

  const abort = useCallback(() => {
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    chunksRef.current = []
  }, [])

  return { start, stop, abort }
}

// ─── TTS (Piper via Tauri) ───────────────────────────────────

export function useTauriTTS(callbacks: TauriTTSCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return

    try {
      cbRef.current.onStart?.()

      // Pedir WAV base64 ao Piper via Tauri
      const wavB64 = await tauriInvoke<string>('speak', { text })
      const wavBytes = base64ToArrayBuffer(wavB64)

      // Reproduzir
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const audioBuffer = await ctx.decodeAudioData(wavBytes)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      sourceRef.current = source

      source.onended = () => {
        ctx.close().catch(() => {})
        audioCtxRef.current = null
        sourceRef.current = null
        cbRef.current.onEnd?.()
      }

      source.start()
    } catch (err) {
      cbRef.current.onError?.(`Erro no TTS: ${err}`)
    }
  }, [])

  const cancel = useCallback(() => {
    sourceRef.current?.stop()
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    sourceRef.current = null
  }, [])

  return { speak, cancel }
}

// ─── Hook de check ───────────────────────────────────────────

export function useTauriVoiceCheck() {
  const [state, setState] = useState<TauriVoiceState>({ ready: false, native: false })

  useEffect(() => {
    if (!isTauri()) {
      setState({ ready: false, native: false })
      return
    }

    tauriInvoke<{ ready: boolean }>('voice_check')
      .then((result) => {
        setState({ ready: result.ready, native: true })
      })
      .catch(() => {
        setState({ ready: false, native: false })
      })
  }, [])

  return state
}

// ─── Utilidades ──────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/** Encode AudioBuffer como WAV 16-bit PCM mono 16kHz */
function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const samples = audioBuffer.getChannelData(0)
  const numSamples = samples.length

  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  // WAV header
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(view, 8, 'WAVE')
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true) // byte rate
  view.setUint16(32, numChannels * 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(view, 36, 'data')
  view.setUint32(40, numSamples * 2, true)

  // PCM samples
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return buffer
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
