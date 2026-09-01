import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { spring, dur } from '../motion/tokens'
import { MusicIcon, SearchIcon } from './IntegrationIcons'
import type { SpotifyTrack } from '../hooks/useSpotifyPlayer'

/* ----------------------------------------------------------------
   SpotifyModal — busca e fila em tela cheia sobre o orb.
   Abre clicando na capa do card.
   ---------------------------------------------------------------- */

const API = 'http://localhost:3000'

interface SearchItem {
  uri: string
  name: string
  subtitle: string
  image: string | null
  durationMs: number | null
}

const TIPOS = [
  { id: 'track', label: 'Músicas' },
  { id: 'album', label: 'Álbuns' },
  { id: 'playlist', label: 'Playlists' },
  { id: 'artist', label: 'Artistas' },
]

interface Props {
  open: boolean
  onClose: () => void
  onPlay: (uri: string) => void
  track: SpotifyTrack | null
  paused: boolean
  onToggle: () => void
  onSeek: (ms: number) => void
  volume: number
  onVolume: (v: number) => void
}

export function SpotifyModal({
  open, onClose, onPlay, track, paused, onToggle, onSeek, volume, onVolume,
}: Props) {
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('track')
  const [items, setItems] = useState<SearchItem[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [lib, setLib] = useState<{
    playlists: SearchItem[]; recent: SearchItem[]; albums: SearchItem[]; artists: SearchItem[]
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Biblioteca — carregada uma vez, pra o modal não abrir vazio
  useEffect(() => {
    if (!open || lib) return
    let cancelado = false
    fetch(`${API}/api/spotify/library`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelado) return
        setLib({
          playlists: d.playlists ?? [],
          recent: d.recent ?? [],
          albums: d.albums ?? [],
          artists: d.artists ?? [],
        })
      })
      .catch(() => setLib({ playlists: [], recent: [], albums: [], artists: [] }))
    return () => { cancelado = true }
  }, [open, lib])

  /** Sem busca ativa, cada aba mostra o conteúdo salvo correspondente. */
  const secoesDaAba = (): Array<[string, SearchItem[]]> => {
    if (!lib) return []
    if (tipo === 'track') return [['Ouvidas recentemente', lib.recent]]
    if (tipo === 'playlist') return [['Suas playlists', lib.playlists]]
    if (tipo === 'album') return [['Seus álbuns', lib.albums]]
    return [['Artistas que você segue', lib.artists]]
  }

  // Foco no campo ao abrir; Esc fecha
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  // Busca com debounce — evita uma requisição por tecla
  useEffect(() => {
    if (!open || !q.trim()) { setItems([]); setErro(''); return }
    let cancelado = false
    setCarregando(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/spotify/search?q=${encodeURIComponent(q)}&type=${tipo}`)
        const d = await r.json()
        if (cancelado) return
        setItems(d.items ?? [])
        setErro(d.error ? 'Não consegui buscar agora' : '')
      } catch {
        if (!cancelado) setErro('Não consegui buscar agora')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }, 350)
    return () => { cancelado = true; clearTimeout(t) }
  }, [q, tipo, open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.base }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 320,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,.55)',
            backdropFilter: 'blur(10px)',
            padding: 24,
          }}
        >
          <motion.div
            className="glass"
            initial={{ scale: 0.97, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={spring.morph}
            style={{
              width: 'min(760px, 94vw)',
              height: 'min(620px, 86vh)',
              borderRadius: 'var(--r-lg)',
              padding: '22px 22px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--t-mid)', display: 'grid', placeItems: 'center' }}>
                <MusicIcon size={20} />
              </span>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--t-hi)' }}>Spotify</span>
              <button
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  marginLeft: 'auto',
                  width: 28, height: 28,
                  borderRadius: 'var(--r-xs)',
                  border: 'none',
                  background: 'var(--fill-1)',
                  color: 'var(--t-low)',
                  cursor: 'pointer',
                  fontSize: 15,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Busca */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0 14px', height: 42,
              borderRadius: 'var(--r-pill)',
              background: 'var(--fill-1)',
              border: '1px solid var(--hair)',
            }}>
              <span style={{ color: 'var(--t-low)', display: 'grid', placeItems: 'center' }}>
                <SearchIcon size={16} />
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar música, álbum, playlist…"
                style={{
                  flex: 1, height: '100%',
                  background: 'none', border: 'none', outline: 'none',
                  color: 'var(--t-hi)', fontSize: 14, fontFamily: 'var(--f)',
                }}
              />
            </div>

            {/* Filtros de tipo */}
            <div style={{ display: 'flex', gap: 6 }}>
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTipo(t.id)}
                  style={{
                    height: 28, padding: '0 13px',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 12.5,
                    fontFamily: 'var(--f)',
                    cursor: 'pointer',
                    color: tipo === t.id ? 'var(--t-hi)' : 'var(--t-low)',
                    background: tipo === t.id ? 'var(--fill-3)' : 'transparent',
                    border: `1px solid ${tipo === t.id ? 'var(--g-edge)' : 'transparent'}`,
                    transition: 'background .2s, color .2s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Resultados */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              maskImage: 'linear-gradient(#000 calc(100% - 26px), transparent)',
            }}>
              {erro ? (
                <Aviso texto={erro} />
              ) : carregando && !items.length ? (
                <Aviso texto="Buscando…" />
              ) : q.trim() ? (
                items.length ? (
                  items.map((it) => (
                    <Linha key={it.uri} item={it} onPlay={() => { onPlay(it.uri); onClose() }} />
                  ))
                ) : (
                  <Aviso texto="Nada encontrado" />
                )
              ) : !lib ? (
                <Aviso texto="Carregando…" />
              ) : secoesDaAba().some(([, itens]) => itens.length) ? (
                secoesDaAba().map(([titulo, itens]) =>
                  itens.length ? (
                    <div key={titulo}>
                      <Secao titulo={titulo} />
                      {itens.map((it) => (
                        <Linha key={it.uri} item={it} onPlay={() => { onPlay(it.uri); onClose() }} />
                      ))}
                    </div>
                  ) : null,
                )
              ) : (
                <Aviso texto="Nada salvo aqui. Use a busca acima." />
              )}
            </div>

            {/* Tocando agora */}
            {track && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                paddingTop: 12, borderTop: '1px solid var(--hair)',
              }}>
                {track.albumArt && (
                  <img src={track.albumArt} alt="" style={{ width: 38, height: 38, borderRadius: 'var(--r-xs)' }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--t-hi)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--t-low)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 5 }}>
                    {track.artists}
                  </div>
                  <Timeline track={track} onSeek={onSeek} />
                </div>
                <button
                  onClick={onToggle}
                  aria-label={paused ? 'Tocar' : 'Pausar'}
                  style={{
                    width: 34, height: 34, flexShrink: 0,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--fill-2)',
                    color: 'var(--t-hi)',
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'grid', placeItems: 'center',
                  }}
                >
                  {paused ? '▶' : '❚❚'}
                </button>
                <VolumeControl value={volume} onChange={onVolume} />
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

/**
 * Volume: ícone (clique silencia/restaura) + slider.
 * O ícone muda com o nível, então dá pra ler o estado sem olhar a barra.
 */
function VolumeControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const anteriorRef = useRef(0.5)

  const alternarMudo = () => {
    if (value > 0) {
      anteriorRef.current = value
      onChange(0)
    } else {
      onChange(anteriorRef.current || 0.5)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
      <button
        onClick={alternarMudo}
        aria-label={value > 0 ? 'Silenciar' : 'Restaurar volume'}
        title={value > 0 ? 'Silenciar' : 'Restaurar volume'}
        style={{
          width: 24, height: 24,
          border: 'none', background: 'none',
          color: 'var(--t-low)', cursor: 'pointer',
          display: 'grid', placeItems: 'center', padding: 0,
        }}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          {value === 0
            ? <path d="M17 9.5l4 5M21 9.5l-4 5" />
            : (
              <>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                {value > 0.55 && <path d="M18.5 6a9 9 0 0 1 0 12" />}
              </>
            )}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label="Volume"
        style={{
          width: 74,
          height: 3,
          accentColor: 'var(--accent)',
          cursor: 'pointer',
        }}
      />
    </div>
  )
}

/** Título de seção na lista (Recentes / Playlists). */
function Secao({ titulo }: { titulo: string }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      color: 'var(--t-low)',
      padding: '12px 10px 5px',
    }}>
      {titulo}
    </div>
  )
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Barra de progresso arrastável.
 * Enquanto arrasta, mostra a posição local — senão o tick de 1s do player
 * puxaria o cursor de volta no meio do gesto.
 */
function Timeline({ track, onSeek }: { track: SpotifyTrack; onSeek: (ms: number) => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const [local, setLocal] = useState(0)

  const pos = arrastando ? local : track.positionMs
  const pct = track.durationMs ? Math.min(100, (pos / track.durationMs) * 100) : 0

  const msNoPonto = (clientX: number) => {
    const el = barRef.current
    if (!el || !track.durationMs) return 0
    const r = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    return frac * track.durationMs
  }

  useEffect(() => {
    if (!arrastando) return
    const mover = (e: PointerEvent) => setLocal(msNoPonto(e.clientX))
    const soltar = (e: PointerEvent) => {
      setArrastando(false)
      onSeek(msNoPonto(e.clientX))
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar, { once: true })
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastando, track.durationMs])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10.5, color: 'var(--t-low)', minWidth: 32, textAlign: 'right' }}>
        {mmss(pos)}
      </span>
      <div
        ref={barRef}
        onPointerDown={(e) => { setLocal(msNoPonto(e.clientX)); setArrastando(true) }}
        style={{
          flex: 1,
          height: 14,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: '100%',
          height: 3,
          borderRadius: 'var(--r-pill)',
          background: 'var(--fill-2)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            borderRadius: 'var(--r-pill)',
            background: 'var(--accent)',
          }} />
          <span style={{
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            width: 9,
            height: 9,
            marginTop: -4.5,
            marginLeft: -4.5,
            borderRadius: '50%',
            background: 'var(--t-hi)',
            opacity: arrastando ? 1 : 0.85,
          }} />
        </div>
      </div>
      <span style={{ fontSize: 10.5, color: 'var(--t-low)', minWidth: 32 }}>
        {mmss(track.durationMs)}
      </span>
    </div>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ padding: '28px 4px', textAlign: 'center', fontSize: 13, color: 'var(--t-low)' }}>
      {texto}
    </div>
  )
}

function Linha({ item, onPlay }: { item: SearchItem; onPlay: () => void }) {
  const [hover, setHover] = useState(false)
  const dur = item.durationMs
    ? `${Math.floor(item.durationMs / 60000)}:${String(Math.floor((item.durationMs % 60000) / 1000)).padStart(2, '0')}`
    : ''

  return (
    <button
      onClick={onPlay}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 10px',
        borderRadius: 'var(--r-xs)',
        border: 'none',
        background: hover ? 'var(--fill-1)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--f)',
        transition: 'background .16s',
      }}
    >
      <span style={{
        width: 40, height: 40, flexShrink: 0,
        borderRadius: 'var(--r-xs)',
        background: 'var(--fill-2)',
        display: 'grid', placeItems: 'center',
        overflow: 'hidden',
      }}>
        {item.image
          ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: 'var(--t-low)' }}><MusicIcon size={16} /></span>}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, color: 'var(--t-hi)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.name}
        </span>
        {item.subtitle && (
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--t-low)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.subtitle}
          </span>
        )}
      </span>
      {dur && <span style={{ fontSize: 11.5, color: 'var(--t-low)', flexShrink: 0 }}>{dur}</span>}
    </button>
  )
}
