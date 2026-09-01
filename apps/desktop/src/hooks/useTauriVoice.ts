import { useRef, useCallback, useEffect, useState } from 'react'
import { getTTSBus, resumeTTSBus } from './ttsAudioBus'
import { cleanForSpeech } from './cleanForSpeech'
import { logUI } from './logUI'

/**
 * Hook que usa Whisper (STT) e Piper (TTS) via Tauri sidecars.
 *
 * STT: grava áudio com MediaRecorder, converte pra WAV, envia pro Whisper via Tauri.
 * TTS: envia texto pro Piper via Tauri, recebe WAV, reproduz via AudioContext.
 */

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

// AudioContext de playback agora vem do ttsAudioBus

// ─── STT (Whisper via Tauri) ─────────────────────────────────

export interface TauriSTTCallbacks {
  onResult?: (text: string) => void
  onError?: (error: string) => void
}

export function useTauriSTT(callbacks: TauriSTTCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const abortedRef = useRef(false)

  const start = useCallback(async () => {
    try {
      abortedRef.current = false
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(250)
    } catch (err) {
      cbRef.current.onError?.(`Erro ao acessar microfone: ${err}`)
    }
  }, [])

  /** Retorna a MediaStream ativa (pra compartilhar com VAD) */
  const getStream = useCallback(() => streamRef.current, [])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      logUI(`stop() sem gravacao ativa (recorder=${!!recorder}, estado=${recorder?.state})`, 'STT/Whisper', 'warn')
      return
    }

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        if (abortedRef.current) { resolve(); return }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        logUI(`audio gravado: ${blob.size} bytes, ${chunksRef.current.length} chunks, ${recorder.mimeType}`, 'STT/Whisper')
        chunksRef.current = []

        try {
          const arrayBuffer = await blob.arrayBuffer()
          // Decodifica na taxa NATIVA do arquivo: forçar 16kHz aqui fazia o
          // WebView2 recusar o WebM/Opus com "Unable to decode audio data".
          // A conversão pra 16k mono (que o Whisper exige) acontece no encodeWav.
          const audioCtx = new AudioContext()
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
          const wavBuffer = encodeWav(audioBuffer)
          const base64 = arrayBufferToBase64(wavBuffer)
          await audioCtx.close()

          logUI(`enviando ao Whisper: ${wavBuffer.byteLength} bytes WAV`, 'STT/Whisper')
          const text = await tauriInvoke<string>('transcribe', { audioB64: base64 })
          logUI('transcricao: ' + JSON.stringify(text), 'STT/Whisper')
          if (text.trim()) {
            cbRef.current.onResult?.(text.trim())
          }
        } catch (err) {
          logUI(`falhou ao decodificar/transcrever: ${err}`, 'STT/Whisper', 'error')
          cbRef.current.onError?.(`Erro na transcrição: ${err}`)
        }

        resolve()
      }

      recorder.stop()
    })
  }, [])

  const abort = useCallback(() => {
    abortedRef.current = true
    if (recorderRef.current?.state !== 'inactive') {
      recorderRef.current?.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    chunksRef.current = []
  }, [])

  return { start, stop, abort, getStream }
}

// ─── TTS (Piper via Tauri) ───────────────────────────────────

export interface TauriTTSCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

export function useTauriTTS(callbacks: TauriTTSCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const cancelledRef = useRef(false)
  const startedRef = useRef(false)

  /** Quebra texto em frases curtas pra Piper processar */
  const splitSentences = (text: string): string[] => {
    // Quebrar por pontuação final, mantendo frases de tamanho razoável
    const parts = text.split(/(?<=[.!?;:])\s+/)
    const sentences: string[] = []
    let current = ''

    for (const part of parts) {
      if (current.length + part.length > 200) {
        if (current) sentences.push(current.trim())
        current = part
      } else {
        current += (current ? ' ' : '') + part
      }
    }
    if (current.trim()) sentences.push(current.trim())
    return sentences.length > 0 ? sentences : [text]
  }

  /** Sintetiza e reproduz uma frase */
  const speakOne = async (sentence: string): Promise<void> => {
    if (cancelledRef.current) return

    const wavB64 = await tauriInvoke<string>('speak', { text: sentence })
    if (cancelledRef.current) return

    const wavBytes = base64ToArrayBuffer(wavB64)
    const bus = getTTSBus()
    await resumeTTSBus()

    const audioBuffer = await bus.ctx.decodeAudioData(wavBytes.slice(0) as ArrayBuffer)
    if (cancelledRef.current) return

    return new Promise<void>((resolve) => {
      const source = bus.ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(bus.input) // -> analyser -> speaker + orb stream
      sourceRef.current = source

      source.onended = () => {
        sourceRef.current = null
        resolve()
      }

      source.start()
      if (!startedRef.current) { startedRef.current = true; cbRef.current.onStart?.() }
    })
  }

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return

    cancelledRef.current = false
    startedRef.current = false

    try {
      const cleaned = cleanForSpeech(text)
      if (!cleaned) { cbRef.current.onEnd?.(); return }
      const sentences = splitSentences(cleaned)

      for (const sentence of sentences) {
        if (cancelledRef.current) break
        await speakOne(sentence)
      }

      if (!cancelledRef.current) cbRef.current.onEnd?.()
    } catch (err) {
      sourceRef.current = null
      if (!cancelledRef.current) cbRef.current.onError?.(`Erro no TTS: ${err}`)
    }
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    try { sourceRef.current?.stop() } catch {}
    sourceRef.current = null
  }, [])

  const isSpeaking = useCallback(() => sourceRef.current !== null, [])

  return { speak, cancel, isSpeaking }
}

// ─── Hook de check ───────────────────────────────────────────

export interface TauriVoiceState {
  ready: boolean
  native: boolean
}

export function useTauriVoiceCheck() {
  const [state, setState] = useState<TauriVoiceState>({ ready: false, native: false })

  useEffect(() => {
    if (!isTauri()) {
      setState({ ready: false, native: false })
      return
    }

    tauriInvoke<{ ready: boolean }>('voice_check')
      .then((result) => setState({ ready: result.ready, native: true }))
      .catch(() => setState({ ready: false, native: false }))
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

/** Reamostra por interpolação linear — o Whisper espera 16kHz mono. */
function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = pos - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1
  const sampleRate = 16000
  const samples = resample(audioBuffer.getChannelData(0), audioBuffer.sampleRate, sampleRate)
  const numSamples = samples.length

  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(view, 8, 'WAVE')
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeStr(view, 36, 'data')
  view.setUint32(40, numSamples * 2, true)

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
