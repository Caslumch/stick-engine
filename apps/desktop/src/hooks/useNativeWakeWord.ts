import { useEffect, useRef } from 'react'

const WAKEWORD_WS_URL = 'ws://localhost:5002/ws'

export interface NativeWakeWordOptions {
  onWake: () => void
  enabled: boolean
}

/**
 * Wake word nativo via OpenWakeWord (serviço local em localhost:5002).
 * Conecta via WebSocket e recebe eventos de detecção.
 * Funciona sem browser — o microfone é capturado pelo serviço Python.
 */
export function useNativeWakeWord({ onWake, enabled }: NativeWakeWordOptions) {
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>(0)
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close()
      wsRef.current = null
      return
    }

    let mounted = true

    const connect = () => {
      if (!mounted) return

      try {
        const ws = new WebSocket(WAKEWORD_WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[NativeWakeWord] Connected to wake word service')
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.event === 'wake_word_detected' && !cooldownRef.current) {
              console.log(`[NativeWakeWord] Detected: ${data.model} (${data.confidence})`)
              cooldownRef.current = true
              onWakeRef.current()

              // Cooldown de 5s pra evitar detecções durante uso do mic
              setTimeout(() => {
                cooldownRef.current = false
              }, 5000)
            }
          } catch {}
        }

        ws.onclose = () => {
          wsRef.current = null
          if (mounted) {
            // Reconectar após 3s
            reconnectTimer.current = window.setTimeout(connect, 3000)
          }
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch {
        // Serviço não disponível — tentar de novo depois
        reconnectTimer.current = window.setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      mounted = false
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
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
    const resp = await fetch('http://localhost:5002/health', {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) return false
    const data = await resp.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}
