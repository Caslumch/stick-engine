import { useJarvisStore } from '../stores/jarvis.store'
import { useAudioAmplitude } from '../hooks/useAudioAmplitude'
import { MicButton } from '../ui/MicButton'
import { RecordingCapsule } from '../ui/RecordingCapsule'
import { STATE_LABELS, VOICE_PROMPTS, DOCK } from '../app/strings'
import type { JarvisState } from '@jarvis/shared'

/**
 * Tela de voz — orb centralizado (renderizado no Canvas persistente),
 * nome do estado, frase, dock com mic ao centro e secundários em colunas fixas.
 * Seções 7 e 11 do DESIGN_SYSTEM.md.
 */
export function Voice() {
  const state = useJarvisStore((s) => s.state)
  const setState = useJarvisStore((s) => s.setState)
  const streamingText = useJarvisStore((s) => s.streamingText)
  const isListening = state === 'listening'

  const { amplitude, start: startAudio, stop: stopAudio } = useAudioAmplitude(isListening)

  const leftAction = getLeftAction(state)
  const rightAction = getRightAction(state)

  const handleMicClick = () => {
    if (state === 'idle') {
      startAudio()
      setState('listening')
    }
  }

  const handleDiscard = () => {
    stopAudio()
    setState('idle')
  }

  const handleSend = () => {
    stopAudio()
    setState('thinking')
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      paddingBottom: 130,
    }}>
      {/* Plate radial atrás do orb */}
      <div style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: 'min(52vh, 540px)',
        height: 'min(52vh, 540px)',
      }}>
        <span style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(var(--accent-rgb), .10), transparent 62%)',
          transition: 'background .7s',
        }} />
      </div>

      {/* Estado + frase */}
      <div style={{ marginTop: 26, textAlign: 'center', maxWidth: 620, padding: '0 20px' }}>
        <div style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          transition: 'color .7s',
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'currentColor',
          }} />
          {STATE_LABELS[state]}
        </div>
        <p style={{
          fontSize: 22,
          lineHeight: 1.45,
          fontWeight: 300,
          color: 'var(--t-hi)',
          letterSpacing: '-.015em',
          minHeight: 64,
          margin: 0,
        }}>
          {streamingText || VOICE_PROMPTS[state]}
        </p>
      </div>

      {/* Dock */}
      <div style={{
        position: 'fixed',
        bottom: 96,
        left: '50%',
        translate: '-50% 0',
        zIndex: 35,
        display: 'grid',
        gridTemplateColumns: '120px 76px 120px',
        alignItems: 'center',
        justifyItems: 'center',
        gap: 16,
      }}>
        <button
          className="glass"
          style={{
            ...ghostStyle,
            visibility: leftAction ? 'visible' : 'hidden',
          }}
          onClick={leftAction?.onClick}
        >
          {leftAction?.label}
        </button>

        {/* Container do mic + cápsula: posição relativa para a cápsula se sobrepor */}
        <div style={{ position: 'relative', width: 76, height: 76 }}>
          <div style={{
            opacity: isListening ? 0 : 1,
            transform: isListening ? 'scale(.82)' : 'none',
            pointerEvents: isListening ? 'none' : 'auto',
            transition: 'opacity .22s linear, transform .24s var(--sp)',
          }}>
            <MicButton onClick={handleMicClick} />
          </div>
          <RecordingCapsule
            active={isListening}
            amplitude={amplitude}
            onDiscard={handleDiscard}
            onSend={handleSend}
            variant="voice"
          />
        </div>

        <button
          className="glass"
          style={{
            ...ghostStyle,
            visibility: rightAction ? 'visible' : 'hidden',
          }}
          onClick={rightAction?.onClick}
        >
          {rightAction?.label}
        </button>
      </div>
    </div>
  )
}

const ghostStyle: React.CSSProperties = {
  height: 40,
  padding: '0 20px',
  borderRadius: 'var(--r-pill)',
  fontSize: 13,
  color: 'var(--t-mid)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--f)',
  transition: 'color .2s',
}

function getLeftAction(state: JarvisState) {
  if (state === 'thinking' || state === 'executing') {
    return { label: DOCK.cancel, onClick: () => useJarvisStore.getState().setState('idle') }
  }
  return null
}

function getRightAction(state: JarvisState) {
  if (state === 'speaking') {
    return { label: DOCK.interrupt, onClick: () => useJarvisStore.getState().setState('idle') }
  }
  if (state === 'error') {
    return { label: DOCK.retry, onClick: () => useJarvisStore.getState().setState('thinking') }
  }
  if (state === 'offline') {
    return { label: DOCK.reconnect, onClick: () => useJarvisStore.getState().setState('idle') }
  }
  return null
}
