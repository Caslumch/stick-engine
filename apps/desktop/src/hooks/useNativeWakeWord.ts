import { useEffect, useRef } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { WAKEWORD_URL } from '../app/endpoints'

const WAKEWORD_WS_URL = WAKEWORD_URL.replace(/^http/, 'ws') + '/ws'

export interface NativeWakeWordOptions {
  onWake: () => void
  enabled: boolean
}

/**
 * Wake word nativo via OpenWakeWord (serviço local em localhost:5002).
 * Conecta via WebSocket e recebe eventos de detecção.
 * O WebSocket fica sempre conectado; o estado idle é checado no callback.
 */
export function useNativeWakeWord({ onWake, enabled }: NativeWakeWordOptions) {
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>(0)
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    let mounted = true

    const connect = () => {
      if (!mounted || wsRef.current) return

      console.log('[NativeWakeWord] Connecting to', WAKEWORD_WS_URL)

      const ws = new WebSocket(WAKEWORD_WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[NativeWakeWord] ✓ Connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[NativeWakeWord] Message:', data.event, data)

          if (data.event === 'wake_word_detected') {
            const state = useJarvisStore.getState().state
            console.log('[NativeWakeWord] Wake detected, state:', state, 'cooldown:', cooldownRef.current)

            if (state === 'idle' && !cooldownRef.current) {
              cooldownRef.current = true
              console.log('[NativeWakeWord] → Triggering onWake!')
              onWakeRef.current()

              setTimeout(() => {
                cooldownRef.current = false
              }, 5000)
            }
          }
        } catch (e) {
          console.warn('[NativeWakeWord] Parse error:', e)
        }
      }

      ws.onclose = () => {
        console.log('[NativeWakeWord] Disconnected')
        wsRef.current = null
        if (mounted) {
          reconnectTimer.current = window.setTimeout(connect, 3000)
        }
      }

      ws.onerror = (e) => {
        console.warn('[NativeWakeWord] Error:', e)
        ws.close()
      }
    }

    connect()

    return () => {
      mounted = false
      clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled])

  return { isSupported: true }
}

/**
 * Checa se o serviço de wake word nativo está rodando.
 */
export async function checkNativeWakeWord(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const resp = await fetch(`${WAKEWORD_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) return false
    const data = await resp.json()
    console.log('[NativeWakeWord] Health check:', data)
    return data.status === 'ok'
  } catch {
    return false
  }
}
