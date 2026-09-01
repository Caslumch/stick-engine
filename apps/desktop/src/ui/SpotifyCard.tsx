import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { spring, dur } from '../motion/tokens'
import { dragTrash } from './DragTrash'
import type { SpotifyTrack } from '../hooks/useSpotifyPlayer'

/* ----------------------------------------------------------------
   SpotifyCard — mini player ao lado do orb.
   Capa, faixa/artista e controles. Vidro simples, sem empilhar.
   ---------------------------------------------------------------- */

interface Props {
  visible: boolean
  ready: boolean
  error: string
  paused: boolean
  track: SpotifyTrack | null
  needsSource?: boolean
  onToggle: () => void
  onNext: () => void
  onPrevious: () => void
  /** Arrastar pra lixeira esconde o card (volta pelo ícone da MetaBar). */
  onDismiss?: () => void
  /** Clique na capa abre a busca em tela cheia. */
  onOpenLibrary?: () => void
}

export function SpotifyCard({
  visible, ready, error, paused, track, needsSource, onToggle, onNext, onPrevious, onDismiss, onOpenLibrary,
}: Props) {
  // posição do pointerdown: distingue clique de arraste na capa
  const pressRef = useRef<{ x: number; y: number } | null>(null)

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="glass"
          drag
          dragMomentum={false}
          dragElastic={0}
          onDragStart={() => onDismiss && dragTrash.start(onDismiss)}
          onDrag={(e) => {
            const evt = e as unknown as PointerEvent
            if (evt.clientY) dragTrash.move(evt.clientY)
          }}
          onDragEnd={() => dragTrash.end()}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ opacity: { duration: dur.base }, x: spring.morph }}
          style={{
            position: 'fixed',
            right: 24,
            top: '50%',
            translateY: '-50%',
            width: 236,
            padding: 14,
            borderRadius: 'var(--r-sm)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: 11,
            cursor: 'grab',
          }}
        >
          {/* Capa — clique abre a busca (arraste não conta como clique) */}
          <div
            onPointerDown={(e) => { pressRef.current = { x: e.clientX, y: e.clientY } }}
            onPointerUp={(e) => {
              const p = pressRef.current
              pressRef.current = null
              if (!p || !onOpenLibrary) return
              const moveu = Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5
              if (!moveu) onOpenLibrary()
            }}
            title="Abrir busca"
            style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: 'var(--r-xs)',
              overflow: 'hidden',
              background: 'var(--fill-1)',
              display: 'grid',
              placeItems: 'center',
              cursor: onOpenLibrary ? 'pointer' : 'default',
            }}>
            {track?.albumArt ? (
              <img
                src={track.albumArt}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 11, color: 'var(--t-low)' }}>
                {error ? '—' : ready ? 'Pronto' : 'Conectando'}
              </span>
            )}
          </div>

          {/* Faixa e artista, ou o erro */}
          <div style={{ minHeight: 34 }}>
            {error ? (
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: 'var(--st-error)' }}>
                {error}
              </p>
            ) : (
              <>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 450,
                  color: 'var(--t-hi)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {track?.name ?? (needsSource ? 'Toque ▶ para começar' : 'Nada tocando')}
                </p>
                <p style={{
                  margin: '2px 0 0',
                  fontSize: 11.5,
                  color: 'var(--t-low)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {track?.artists ?? ''}
                </p>
              </>
            )}
          </div>

          {/* Controles */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Control label="Anterior" onClick={onPrevious} disabled={!ready}>‹‹</Control>
            <Control label={paused ? 'Tocar' : 'Pausar'} onClick={onToggle} disabled={!ready} primary>
              {paused ? '▶' : '❚❚'}
            </Control>
            <Control label="Próxima" onClick={onNext} disabled={!ready}>››</Control>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function Control({
  children, onClick, disabled, primary, label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        border: 'none',
        background: primary ? 'var(--fill-2)' : 'transparent',
        color: disabled ? 'var(--t-low)' : 'var(--t-hi)',
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: primary ? '50%' : 'var(--r-xs)',
        width: primary ? 34 : 26,
        height: primary ? 34 : 26,
        fontSize: primary ? 12 : 14,
        display: 'grid',
        placeItems: 'center',
        opacity: disabled ? 0.45 : 1,
        transition: `opacity ${dur.fast}s linear`,
      }}
    >
      {children}
    </button>
  )
}
