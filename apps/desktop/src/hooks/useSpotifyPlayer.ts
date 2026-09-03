import { useCallback, useEffect, useRef, useState } from 'react'

import { logUI } from './logUI'
import { API_URL } from '../app/endpoints'
/**
 * Spotify Web Playback SDK — transforma o app num dispositivo Spotify.
 *
 * Diferente da API de controle remoto (que so comanda o app do Spotify aberto),
 * aqui o audio sai do proprio Jarvis. Requer Premium e token de usuario com
 * escopo `streaming` (ver /api/spotify/login).
 */

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js'
const API = API_URL

/**
 * Loga no terminal da API com o escopo "Spotify".
 * Usa o logUI compartilhado — antes havia uma cópia local desta lógica.
 */
function log(...args: unknown[]) {
  const msg = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
  logUI(msg, 'Spotify')
}

export interface SpotifyTrack {
  name: string
  artists: string
  albumArt: string | null
  durationMs: number
  positionMs: number
}

interface SpotifyPlayerLike {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: string, cb: (payload: any) => void): boolean
  togglePlay(): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  seek(positionMs: number): Promise<void>
  setVolume(v: number): Promise<void>
  getVolume(): Promise<number>
}

declare global {
  interface Window {
    Spotify?: { Player: new (opts: any) => SpotifyPlayerLike }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

/** Carrega o script do SDK uma unica vez, mesmo com varios chamadores. */
let sdkPromise: Promise<void> | null = null
function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    if (window.Spotify) return resolve()
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const el = document.createElement('script')
    el.src = SDK_SRC
    el.async = true
    el.onerror = () => reject(new Error('Falha ao carregar o SDK do Spotify'))
    document.head.appendChild(el)
  })
  return sdkPromise
}

/**
 * Aceita URI (`spotify:playlist:ID`) ou link do app
 * (`https://open.spotify.com/playlist/ID?si=...`) e devolve sempre a URI.
 * Links com locale (`/intl-pt/playlist/ID`) tambem funcionam.
 */
export function normalizeSpotifyUri(input: string): string {
  const v = (input ?? '').trim()
  if (!v) return ''
  if (v.startsWith('spotify:')) return v

  const m = v.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist)\/([A-Za-z0-9]+)/)
  return m ? `spotify:${m[1]}:${m[2]}` : v
}

/**
 * Escolhe algo da biblioteca do usuario pra tocar quando nao ha contexto
 * pra retomar. Tenta, nessa ordem: tocadas recentes, salvas, top tracks.
 */
async function pickSomethingToPlay(token: string): Promise<string[]> {
  const headers = { Authorization: `Bearer ${token}` }
  const fontes: Array<[string, (j: any) => string[]]> = [
    ['me/player/recently-played?limit=10', (j) => (j.items ?? []).map((i: any) => i.track?.uri)],
    ['me/tracks?limit=20', (j) => (j.items ?? []).map((i: any) => i.track?.uri)],
    ['me/top/tracks?limit=20', (j) => (j.items ?? []).map((i: any) => i.uri)],
  ]

  for (const [path, extrair] of fontes) {
    try {
      const r = await fetch(`https://api.spotify.com/v1/${path}`, { headers })
      if (!r.ok) {
        // 403 aqui normalmente = token sem os escopos novos (reconectar resolve)
        log(`fonte ${path.split('?')[0]} ->`, r.status, r.status === 403 ? '(faltam escopos: reconecte)' : '')
        continue
      }
      const uris = extrair(await r.json()).filter(Boolean)
      if (uris.length) return uris
    } catch (e) {
      log(`fonte ${path.split('?')[0]} falhou:`, String(e))
    }
  }
  return []
}

/**
 * Id do dispositivo "Jarvis" segundo a API do Spotify.
 *
 * O id que o evento `ready` do SDK entrega pode ficar obsoleto quando o
 * player reconecta — a API entao responde 404 "Device not found". Consultar
 * na hora garante que estamos falando do dispositivo que existe agora.
 */
async function resolveDeviceId(token: string, fallback: string | null): Promise<string | null> {
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return fallback
    const { devices = [] } = await r.json()
    const jarvis = devices.find((d: any) => d.name === 'Jarvis')
    return jarvis?.id ?? fallback
  } catch {
    return fallback
  }
}

async function fetchToken(): Promise<string | null> {
  try {
    const r = await fetch(`${API}/api/spotify/token`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return null
    const d = await r.json()
    return d.token ?? null
  } catch {
    return null
  }
}

export function useSpotifyPlayer(enabled: boolean, fallbackUri = '') {
  const playerRef = useRef<SpotifyPlayerLike | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const preDuckVolumeRef = useRef<number | null>(null)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(true)
  const [track, setTrack] = useState<SpotifyTrack | null>(null)
  /** Player conectado mas sem fila — precisa de uma fonte pra comecar. */
  const [needsSource, setNeedsSource] = useState(false)
  /** Volume 0..1 — espelha o do SDK pra UI poder mostrar o slider. */
  const [volume, setVolumeState] = useState(0.5)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    ;(async () => {
      const token = await fetchToken()
      if (cancelled) return
      if (!token) {
        setError('Spotify não conectado')
        log('sem token — faça Conectar em Ajustes → Spotify')
        return
      }

      try {
        await loadSdk()
      } catch (e) {
        if (!cancelled) setError(String(e))
        return
      }
      if (cancelled || !window.Spotify) return

      const player = new window.Spotify.Player({
        name: 'Jarvis',
        // o SDK chama isto sempre que precisa de token — inclusive ao renovar
        getOAuthToken: (cb: (t: string) => void) => { fetchToken().then((t) => t && cb(t)) },
        volume: 0.5,
      })
      playerRef.current = player

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id
        setReady(true)
        setError('')
        log('dispositivo pronto:', device_id)
      })
      player.addListener('not_ready', () => {
        setReady(false)
        log('dispositivo offline')
      })
      player.addListener('player_state_changed', (state: any) => {
        if (!state) return
        setPaused(state.paused)
        const t = state.track_window?.current_track
        if (t) {
          // Tem faixa carregada: nao precisa mais de fonte
          setNeedsSource(false)
          setTrack({
            name: t.name,
            artists: (t.artists ?? []).map((a: any) => a.name).join(', '),
            albumArt: t.album?.images?.[0]?.url ?? null,
            durationMs: state.duration ?? 0,
            positionMs: state.position ?? 0,
          })
        }
      })
      for (const ev of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
        player.addListener(ev, ({ message }: { message: string }) => {
          // account_error normalmente = conta sem Premium
          log(`evento ${ev}:`, message ?? '(sem mensagem)')
          if (ev === 'account_error') return setError('Spotify Premium necessário')
          // "no list was loaded" = player pronto, mas sem fila. Nao e erro de
          // configuracao: some sozinho quando algo comeca a tocar.
          if (/no list was loaded/i.test(message ?? '')) {
            setError('')
            setNeedsSource(true)
            return
          }
          setError(message)
        })
      }

      await player.connect()
    })()

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
      playerRef.current = null
      setReady(false)
    }
  }, [enabled])

  /**
   * Play/pause. Com a fila vazia o togglePlay do SDK falha
   * ("no list was loaded"), entao mandamos tocar via API neste dispositivo —
   * o Spotify retoma o que voce ouvia por ultimo.
   */
  // O SDK só emite estado quando algo muda; sem isto a timeline ficaria parada.
  useEffect(() => {
    if (!enabled || paused || !track) return
    const id = setInterval(() => {
      setTrack((t) =>
        t && t.positionMs < t.durationMs ? { ...t, positionMs: t.positionMs + 1000 } : t,
      )
    }, 1000)
    return () => clearInterval(id)
  }, [enabled, paused, track?.name])

  const togglePlay = useCallback(async () => {
    const p = playerRef.current
    if (!p) return
    if (!needsSource) return p.togglePlay()

    const token = await fetchToken()
    if (!token) return
    // o id do evento `ready` pode estar obsoleto -> confirmar na API
    const deviceId = await resolveDeviceId(token, deviceIdRef.current)
    if (!deviceId) {
      log('dispositivo Jarvis não encontrado na API')
      setError('Player não registrado no Spotify')
      return
    }
    deviceIdRef.current = deviceId

    const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    try {
      // 1) tenta retomar o que estava tocando
      let r = await fetch(url, { method: 'PUT', headers })

      log('retomar reprodução ->', r.status)

      // 2) sem contexto: usa a URI configurada nos Ajustes
      if (!r.ok && r.status !== 204 && fallbackUri) {
        const uri = normalizeSpotifyUri(fallbackUri)
        const body = uri.includes(':track:') ? { uris: [uri] } : { context_uri: uri }
        r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
        log(`URI dos Ajustes (${uri}) ->`, r.status, r.ok ? '' : await r.clone().text())
      }

      // 3) ainda nada: pega algo da propria biblioteca
      if (!r.ok && r.status !== 204) {
        const uris = await pickSomethingToPlay(token)
        log('biblioteca: encontrei', uris.length, 'faixas')
        if (!uris.length) {
          setError('Nada para tocar — configure uma playlist nos Ajustes')
          return
        }
        r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ uris }) })
        log('tocar da biblioteca ->', r.status)
      }

      if (r.ok || r.status === 204) {
        setNeedsSource(false)
        setError('')
        log('reprodução iniciada')
      } else {
        const detalhe = await r.text().catch(() => '')
        log('falhou:', r.status, detalhe.slice(0, 200))
        setError('Não consegui iniciar a reprodução')
      }
    } catch (e) {
      log('exceção no play:', String(e))
      setError('Falha ao iniciar reprodução')
    }
  }, [needsSource, fallbackUri])
  const next = useCallback(() => { playerRef.current?.nextTrack() }, [])
  const previous = useCallback(() => { playerRef.current?.previousTrack() }, [])

  /** Pula pra um ponto da faixa (ms). Usado pela timeline do modal. */
  const seek = useCallback((positionMs: number) => {
    playerRef.current?.seek(Math.max(0, Math.round(positionMs)))
    // atualiza na hora: o evento do SDK pode demorar alguns centesimos
    setTrack((t) => (t ? { ...t, positionMs } : t))
  }, [])

  /**
   * Volume escolhido pelo usuário (0..1).
   * Se o agente estiver falando (duck ativo), guarda como o valor a restaurar
   * em vez de aplicar agora — senão a fala voltaria a competir com a música.
   */
  const setVolume = useCallback(async (v: number) => {
    const vol = Math.min(1, Math.max(0, v))
    setVolumeState(vol)
    const p = playerRef.current
    if (!p) return
    try {
      if (preDuckVolumeRef.current !== null) preDuckVolumeRef.current = vol
      else await p.setVolume(vol)
    } catch { /* player pode ter desconectado */ }
  }, [])

  /** Abaixa o volume enquanto o agente fala e restaura depois. */
  const duck = useCallback(async (on: boolean) => {
    const p = playerRef.current
    if (!p) return
    try {
      if (on) {
        if (preDuckVolumeRef.current !== null) return // ja abaixado
        const v = await p.getVolume()
        preDuckVolumeRef.current = v
        await p.setVolume(Math.max(0, v * 0.15))
      } else {
        const v = preDuckVolumeRef.current
        preDuckVolumeRef.current = null
        if (v !== null) {
          await p.setVolume(v)
          setVolumeState(v) // slider volta a refletir o volume real
        }
      }
    } catch { /* player pode ter desconectado */ }
  }, [])

  /**
   * Toca uma URI neste dispositivo.
   * Aceita tanto `spotify:playlist:ID` quanto o link copiado do app
   * (`https://open.spotify.com/playlist/ID?si=...`).
   */
  const playUri = useCallback(async (raw: string) => {
    const uri = normalizeSpotifyUri(raw)
    const token = await fetchToken()
    if (!token || !uri) return
    const deviceId = await resolveDeviceId(token, deviceIdRef.current)
    if (!deviceId) return log('autoplay: dispositivo não encontrado')
    deviceIdRef.current = deviceId

    const body = uri.includes(':track:') ? { uris: [uri] } : { context_uri: uri }
    try {
      const r = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      log(`autoplay (${uri}) ->`, r.status)
      if (r.ok || r.status === 204) setNeedsSource(false)
    } catch (e) {
      log('autoplay falhou:', String(e))
    }
  }, [])

  return {
    ready, error, paused, track, needsSource, volume,
    togglePlay, next, previous, seek, setVolume, duck, playUri,
  }
}
