import { useState, useEffect, useCallback, useRef } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { useAudioAmplitude } from '../hooks/useAudioAmplitude'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { useTauriSTT, useTauriTTS, useTauriVoiceCheck } from '../hooks/useTauriVoice'
import { useSocket } from '../hooks/useSocket'
import { MicButton } from '../ui/MicButton'
import { RecordingCapsule } from '../ui/RecordingCapsule'
import { STATE_LABELS, VOICE_PROMPTS, DOCK } from '../app/strings'
import type { JarvisState } from '@jarvis/shared'

/**
 * Tela de voz — orb centralizado (renderizado no Canvas persistente),
 * nome do estado, frase, dock com mic ao centro e secundários em colunas fixas.
 * Seções 7 e 11 do DESIGN_SYSTEM.md.
 *
 * Fluxo de voz (Fase 4):
 * idle -> mic click -> listening (STT captura) -> send -> thinking
 * -> backend responde -> speaking (TTS fala) -> idle
 *
 * Usa Whisper/Piper (Tauri sidecars) quando disponível,
 * fallback pra Web Speech API no browser.
 */
export function Voice() {
  const state = useJarvisStore((s) => s.state)
  const setState = useJarvisStore((s) => s.setState)
  const streamingText = useJarvisStore((s) => s.streamingText)
  const isListening = state === 'listening'

  const { amplitude, start: startAudio, stop: stopAudio } = useAudioAmplitude(isListening)
  const { sendMessage } = useSocket()

  // Verificar se estamos no Tauri (WebView2 não tem Web Speech API)
  const voiceCheck = useTauriVoiceCheck()
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const useNative = inTauri // No Tauri, sempre usar sidecars (WebView2 não tem SpeechRecognition)

  // Transcrição parcial local (o que o STT está captando)
  const [transcript, setTranscript] = useState('')
  const transcriptRef = useRef('')

  // --- Speech-to-Text (Web Speech API fallback) ---
  const webStt = useSpeechRecognition({
    onInterim: (text) => {
      setTranscript(text)
      transcriptRef.current = text
    },
    onResult: (text) => {
      setTranscript((prev) => {
        const full = prev ? prev + ' ' + text : text
        transcriptRef.current = full
        return full
      })
    },
    onEnd: () => {},
    onError: (err) => {
      console.warn('[STT/Web] Erro:', err)
    },
  })

  // --- Speech-to-Text (Whisper via Tauri) ---
  const tauriStt = useTauriSTT({
    onResult: (text) => {
      setTranscript(text)
      transcriptRef.current = text
    },
    onError: (err) => {
      console.warn('[STT/Whisper] Erro:', err)
    },
  })

  // Selecionar o STT ativo
  const stt = useNative ? tauriStt : webStt

  // --- Text-to-Speech (Web Speech API fallback) ---
  const webTts = useSpeechSynthesis({
    onStart: () => {},
    onEnd: () => {
      const current = useJarvisStore.getState().state
      if (current === 'speaking') setState('idle')
    },
    onError: (err) => {
      console.warn('[TTS/Web] Erro:', err)
      setState('idle')
    },
  })

  // --- Text-to-Speech (Piper via Tauri) ---
  const tauriTts = useTauriTTS({
    onStart: () => {},
    onEnd: () => {
      const current = useJarvisStore.getState().state
      if (current === 'speaking') setState('idle')
    },
    onError: (err) => {
      console.warn('[TTS/Piper] Erro:', err)
      setState('idle')
    },
  })

  // Selecionar o TTS ativo
  const tts = useNative ? tauriTts : webTts

  // Quando uma mensagem completa chega do backend e estamos na tela de voz,
  // ler a resposta em voz alta
  const lastMessageCount = useRef(0)
  const messages = useJarvisStore((s) => s.messages)

  useEffect(() => {
    if (messages.length <= lastMessageCount.current) {
      lastMessageCount.current = messages.length
      return
    }
    lastMessageCount.current = messages.length

    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && last.content) {
      setState('speaking')
      tts.speak(last.content)
    }
  }, [messages, setState, tts])

  const handleCancel = useCallback(() => {
    tts.cancel()
    setState('idle')
  }, [tts, setState])

  const handleInterrupt = useCallback(() => {
    tts.cancel()
    setState('idle')
  }, [tts, setState])

  const leftAction = getLeftAction(state, handleCancel)
  const rightAction = getRightAction(state, handleInterrupt)

  const handleMicClick = () => {
    if (state === 'idle') {
      setTranscript('')
      transcriptRef.current = ''
      startAudio()
      stt.start()
      setState('listening')
    }
  }

  const handleDiscard = () => {
    stt.abort()
    stopAudio()
    setTranscript('')
    transcriptRef.current = ''
    setState('idle')
  }

  const handleSend = async () => {
    stopAudio()

    if (useNative) {
      // Whisper: parar gravação → transcrição acontece no stop()
      // O resultado chega via callback onResult que seta transcriptRef
      setTranscript('Transcrevendo...')
      await stt.stop()
      const text = transcriptRef.current.trim()
      setTranscript('')
      transcriptRef.current = ''
      if (text && text !== 'Transcrevendo...') {
        setState('thinking')
        sendMessage(text)
      } else {
        setState('idle')
      }
    } else {
      // Web Speech API: transcrição já está em transcriptRef
      stt.stop()
      const text = transcriptRef.current.trim()
      setTranscript('')
      transcriptRef.current = ''
      if (text) {
        setState('thinking')
        sendMessage(text)
      } else {
        setState('idle')
      }
    }
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
          {isListening && transcript
            ? transcript
            : streamingText || VOICE_PROMPTS[state]}
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

function getLeftAction(state: JarvisState, onCancel?: () => void) {
  if (state === 'thinking' || state === 'executing') {
    return { label: DOCK.cancel, onClick: onCancel ?? (() => useJarvisStore.getState().setState('idle')) }
  }
  return null
}

function getRightAction(state: JarvisState, onInterrupt?: () => void) {
  if (state === 'speaking') {
    return { label: DOCK.interrupt, onClick: onInterrupt ?? (() => useJarvisStore.getState().setState('idle')) }
  }
  if (state === 'error') {
    return { label: DOCK.retry, onClick: () => useJarvisStore.getState().setState('thinking') }
  }
  if (state === 'offline') {
    return { label: DOCK.reconnect, onClick: () => useJarvisStore.getState().setState('idle') }
  }
  return null
}
