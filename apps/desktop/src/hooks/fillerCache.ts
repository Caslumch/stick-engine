import { getTTSBus, resumeTTSBus } from './ttsAudioBus'
import { useJarvisStore } from '../stores/jarvis.store'
import { TTS_URL } from '../app/endpoints'

/* ----------------------------------------------------------------
   fillerCache — pré-gera fillers comuns no startup.
   Playback instantâneo (~5ms) em vez de fetch + decode (~2-3s).
   ---------------------------------------------------------------- */

const FILLERS = [
  'Hmm, deixa eu ver...',
  'Um momento...',
  'Já já...',
  'Boa pergunta...',
  'Deixa eu pensar...',
]


let cache: AudioBuffer[] = []
let ready = false
let loading = false

/** Carrega todos os fillers em background. Chamar uma vez no startup. */
export async function preloadFillers() {
  if (loading || ready) return
  loading = true

  try {
    const settings = useJarvisStore.getState().settings
    const engine = settings['tts.engine'] || 'edge'
    const voice = settings['tts.voice'] || ''

    const bus = getTTSBus()
    await resumeTTSBus()

    const buffers = await Promise.all(
      FILLERS.map(async (text) => {
        try {
          const resp = await fetch(`${TTS_URL}/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, engine, voice }),
          })
          if (!resp.ok) return null
          const bytes = await resp.arrayBuffer()
          return bus.ctx.decodeAudioData(bytes.slice(0))
        } catch {
          return null
        }
      }),
    )

    cache = buffers.filter((b): b is AudioBuffer => b !== null)
    ready = cache.length > 0
    if (ready) console.log(`[FillerCache] ${cache.length} fillers pré-cacheados`)
  } catch {
    console.warn('[FillerCache] Falha ao pré-cachear fillers')
  } finally {
    loading = false
  }
}

/** Toca um filler aleatório instantaneamente. Retorna true se tocou. */
export function playFiller(): boolean {
  if (!ready || cache.length === 0) return false

  try {
    const bus = getTTSBus()
    const buffer = cache[Math.floor(Math.random() * cache.length)]
    const source = bus.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(bus.input)
    source.start()
    return true
  } catch {
    return false
  }
}

export function isFillerCacheReady(): boolean {
  return ready
}
