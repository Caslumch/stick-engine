import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer'

/**
 * Mantém o player do Spotify vivo acima das telas.
 *
 * Antes o hook vivia dentro de <Voice/>, que desmonta ao trocar de aba:
 * o SDK desconectava (a música parava) e reconectava ao voltar, disparando
 * o autoplay de novo. Aqui ele monta uma vez, como o <Canvas> do orb.
 */

type SpotifyApi = ReturnType<typeof useSpotifyPlayer>

const Ctx = createContext<SpotifyApi | null>(null)

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const settings = useJarvisStore((s) => s.settings)
  const enabled = settings['spotify.player.enabled'] === 'true'
  const autoplayUri = settings['spotify.player.autoplayUri'] ?? ''
  const player = useSpotifyPlayer(enabled, autoplayUri)

  // Toca a URI configurada uma unica vez por sessao, quando o player conecta.
  const autoplayedRef = useRef(false)
  useEffect(() => {
    if (!enabled || !player.ready || autoplayedRef.current || !autoplayUri) return
    autoplayedRef.current = true
    // folga: o Spotify leva ~1s pra propagar o dispositivo recem-registrado
    const t = setTimeout(() => player.playUri(autoplayUri), 1200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.ready, enabled, autoplayUri])

  return <Ctx.Provider value={player}>{children}</Ctx.Provider>
}

/** Player compartilhado. Só pode ser usado dentro do <SpotifyProvider>. */
export function useSpotify(): SpotifyApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSpotify precisa estar dentro de <SpotifyProvider>')
  return ctx
}
