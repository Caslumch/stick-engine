import { useEffect } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { isTTSPlaying } from '../hooks/ttsAudioBus'
import type { JarvisState } from '@jarvis/shared'

/**
 * Cores do estado do agente — seção 4 do DESIGN_SYSTEM.md.
 * idle usa --base (personalizável); os demais são fixos.
 */
const STATE_COLORS: Record<JarvisState, string | null> = {
  idle: null, // usa a cor base do usuário
  listening: '#57C8FF',
  thinking: '#8B7BFF',
  executing: '#A6F05A',
  speaking: '#7DD3FC',
  error: '#FF6B6B',
  offline: '#8A968F',
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

const DEFAULT_BASE = '#4ADFB0'

/**
 * Escreve --accent e --accent-rgb no <html> a cada troca de estado.
 * Também escreve data-state para regras CSS condicionais.
 *
 * Monitora o TTS audio bus: se tem áudio tocando e estado é idle,
 * corrige pra speaking. Se estado é speaking mas áudio parou, volta pra idle.
 *
 * Nenhum componente deve importar cor de estado diretamente — todos leem var(--accent).
 */
export function AgentStateProvider({ children }: { children: React.ReactNode }) {
  const state = useJarvisStore((s) => s.state)

  useEffect(() => {
    const color = STATE_COLORS[state] ?? DEFAULT_BASE
    const el = document.documentElement
    el.style.setProperty('--accent', color)
    el.style.setProperty('--accent-rgb', hexToRgb(color))
    el.dataset.state = state
  }, [state])

  // Polling global: sincroniza estado com áudio real do TTS
  // Grace period de 800ms pra não flickar durante pausas entre frases
  useEffect(() => {
    let silentSince = 0

    const id = setInterval(() => {
      const current = useJarvisStore.getState().state
      const playing = isTTSPlaying()

      if (playing) {
        silentSince = 0
        if (current === 'idle') {
          useJarvisStore.getState().setState('speaking')
        }
      } else if (current === 'speaking') {
        if (silentSince === 0) {
          silentSince = Date.now()
        } else if (Date.now() - silentSince > 800) {
          useJarvisStore.getState().setState('idle')
          silentSince = 0
        }
      }
    }, 200)

    return () => clearInterval(id)
  }, [])

  return <>{children}</>
}
