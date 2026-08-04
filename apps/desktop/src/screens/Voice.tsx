import { useState, useEffect, useCallback, useRef } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { useAudioAmplitude } from '../hooks/useAudioAmplitude'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { useTauriSTT, useTauriTTS, useTauriVoiceCheck } from '../hooks/useTauriVoice'
import { useServerTTS, checkServerTTS } from '../hooks/useServerTTS'
import { useVAD } from '../hooks/useVAD'
import { useWakeWord } from '../hooks/useWakeWord'
import { useNativeWakeWord, checkNativeWakeWord } from '../hooks/useNativeWakeWord'
import { useSocket } from '../hooks/useSocket'
import { MicButton } from '../ui/MicButton'
import { RecordingCapsule } from '../ui/RecordingCapsule'
import { ToolHUD } from '../ui/ToolHUD'
import { TerminalFeed } from '../ui/TerminalFeed'
import { DataArtifact } from '../ui/DataArtifact'
import { orbDragStart, orbDragMove, orbDragEnd } from '../orb/orbDrag'
import { ttsLock } from '../hooks/ttsLock'
import { STATE_LABELS, VOICE_PROMPTS, DOCK, TOOL_LABELS } from '../app/strings'
import type { JarvisState } from '@jarvis/shared'

/**
 * Tela de voz — fluxo conversacional natural:
 *
 * 1. Clica no mic → listening (grava áudio)
 * 2. VAD detecta silêncio (~1.5s) → auto-envia (ou clica enviar)
 * 3. Transcreve (Whisper ou Web Speech) → envia ao backend
 * 4. Backend responde → TTS fala a resposta → idle
 * 5. Barge-in: falar durante TTS cancela e volta a listening
 */

const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window


export function Voice() {
  const state = useJarvisStore((s) => s.state)
  const setState = useJarvisStore((s) => s.setState)
  const streamingText = useJarvisStore((s) => s.streamingText)
  const fillerText = useJarvisStore((s) => s.fillerText)
  const toolExecutions = useJarvisStore((s) => s.toolExecutions)
  const addToolExecution = useJarvisStore((s) => s.addToolExecution)
  const updateToolExecution = useJarvisStore((s) => s.updateToolExecution)
  const isListening = state === 'listening'

  const { amplitude, start: startAudio, stop: stopAudio } = useAudioAmplitude(isListening)
  const { sendMessage } = useSocket()

  const [transcript, setTranscript] = useState('')
  const transcriptRef = useRef('')
  const [error, setError] = useState('')
  const sendingRef = useRef(false) // Previne duplo envio

  // --- STT ---
  const webStt = useSpeechRecognition({
    onInterim: (text) => { setTranscript(text); transcriptRef.current = text },
    onResult: (text) => {
      setTranscript((prev) => {
        const full = prev ? prev + ' ' + text : text
        transcriptRef.current = full
        return full
      })
    },
    onEnd: () => {},
    onError: (err) => { setError(`Microfone: ${err}`); console.warn('[STT/Web]', err) },
  })

  const tauriStt = useTauriSTT({
    onResult: (text) => { setTranscript(text); transcriptRef.current = text },
    onError: (err) => { setError(`Transcrição: ${err}`); console.warn('[STT/Whisper]', err) },
  })

  const stt = IN_TAURI ? tauriStt : webStt

  // --- TTS (via ref estável) ---
  const ttsRef = useRef<{ speak: (t: string) => void; cancel: () => void; isSpeaking: () => boolean }>({
    speak: () => {}, cancel: () => {}, isSpeaking: () => false,
  })

  const ttsStartCb = () => { ttsLock.active = true; setState('speaking') }
  const ttsEndCb = () => { ttsLock.active = false; if (useJarvisStore.getState().state === 'speaking') setState('idle') }
  const ttsErrCb = (err: string) => { ttsLock.active = false; setError(`Voz: ${err}`); setState('idle') }

  const webTts = useSpeechSynthesis({ onStart: ttsStartCb, onEnd: ttsEndCb, onError: ttsErrCb })
  const tauriTts = useTauriTTS({ onStart: ttsStartCb, onEnd: ttsEndCb, onError: ttsErrCb })
  const serverTts = useServerTTS({ onStart: ttsStartCb, onEnd: ttsEndCb, onError: ttsErrCb })

  // Checar se Qwen3-TTS está disponível (funciona em browser e Tauri)
  const [serverReady, setQwenReady] = useState(false)
  useEffect(() => {
    checkServerTTS().then(setQwenReady)
  }, [])

  // Prioridade: Qwen3-TTS > Tauri/Piper > Web Speech API
  if (serverReady) {
    ttsRef.current = serverTts
  } else if (IN_TAURI) {
    ttsRef.current = tauriTts
  } else {
    ttsRef.current = webTts
  }

  // --- Função de envio centralizada ---
  const doSend = useCallback(async () => {
    if (sendingRef.current) return
    sendingRef.current = true

    stopAudio()
    vad.stop()

    if (IN_TAURI) {
      // Feedback imediato: muda pra thinking e fala filler enquanto Whisper processa
      setState('thinking')
      setTranscript('Transcrevendo...')
      addToolExecution({ toolName: '_stt_transcribe', status: 'executing' })

      // Filler imediato durante transcrição
      const fillers = ['Hmm, deixa eu ouvir...', 'Um momento...', 'Já já...', 'Deixa eu ver...']
      const filler = fillers[Math.floor(Math.random() * fillers.length)]
      const settings = useJarvisStore.getState().settings
      const engine = settings['tts.engine'] || 'edge'
      const voice = settings['tts.voice'] || ''
      fetch('http://localhost:5001/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: filler, engine, voice }),
      }).then(async (resp) => {
        if (!resp.ok || cancelledRef.current) return
        const { getTTSBus, resumeTTSBus } = await import('../hooks/ttsAudioBus')
        const bytes = await resp.arrayBuffer()
        const bus = getTTSBus()
        await resumeTTSBus()
        // Só tocar se ainda estamos transcrevendo
        if (useJarvisStore.getState().state !== 'thinking') return
        const audioBuffer = await bus.ctx.decodeAudioData(bytes.slice(0))
        const source = bus.ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(bus.input)
        source.start()
      }).catch(() => {})

      await stt.stop()
      updateToolExecution('_stt_transcribe', { success: true, message: transcriptRef.current.trim() || 'sem áudio' })
      const text = transcriptRef.current.trim()
      setTranscript('')
      transcriptRef.current = ''
      sendingRef.current = false
      if (text && text !== 'Transcrevendo...') {
        sendMessage(text)
      } else {
        setState('idle')
      }
    } else {
      stt.stop()
      const text = transcriptRef.current.trim()
      setTranscript('')
      transcriptRef.current = ''
      sendingRef.current = false
      if (text) {
        setState('thinking')
        sendMessage(text)
      } else {
        setState('idle')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState, sendMessage, stopAudio])

  // --- VAD: auto-enviar quando detecta silêncio ---
  const vad = useVAD({
    threshold: 0.015,
    silenceDuration: 1500,
    onSilence: () => {
      // Só auto-enviar se estamos em listening
      if (useJarvisStore.getState().state === 'listening') {
        doSend()
      }
    },
  })

  // --- Barge-in: detectar voz sustentada durante TTS ---
  // Threshold alto (0.06) + 400ms de voz contínua pra evitar falsos positivos
  // por barulho de fundo, música, etc.
  const bargeInVad = useVAD({
    threshold: 0.06,
    voiceConfirmMs: 400,
    silenceDuration: 500,
    onVoiceStart: () => {
      const current = useJarvisStore.getState().state
      if (current === 'speaking') {
        // Interromper TTS e voltar a ouvir
        ttsRef.current.cancel()
        setState('listening')
        setTranscript('')
        transcriptRef.current = ''
        startAudio()
        stt.start()
        vad.start()
        bargeInVad.stop()
      }
    },
  })

  // Quando o estado muda pra 'speaking', iniciar detecção de barge-in
  useEffect(() => {
    if (state === 'speaking') {
      bargeInVad.start()
    } else {
      bargeInVad.stop()
    }
    return () => bargeInVad.stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // --- Falar filler enquanto LLM processa ---
  const fillerSpokenRef = useRef('')
  useEffect(() => {
    if (state === 'thinking' && fillerText && fillerText !== fillerSpokenRef.current) {
      fillerSpokenRef.current = fillerText
      // Fala o filler sem mudar o estado pra 'speaking' — continua 'thinking'
      const settings = useJarvisStore.getState().settings
      const engine = settings['tts.engine'] || 'edge'
      const voice = settings['tts.voice'] || ''
      fetch('http://localhost:5001/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fillerText, engine, voice }),
      }).then(async (resp) => {
        if (!resp.ok || cancelledRef.current) return
        const { getTTSBus, resumeTTSBus } = await import('../hooks/ttsAudioBus')
        const bytes = await resp.arrayBuffer()
        const bus = getTTSBus()
        await resumeTTSBus()
        const audioBuffer = await bus.ctx.decodeAudioData(bytes.slice(0))
        if (useJarvisStore.getState().state !== 'thinking') return
        const source = bus.ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(bus.input)
        source.start()
      }).catch(() => {})
    }
    if (state !== 'thinking') {
      fillerSpokenRef.current = ''
    }
  }, [state, fillerText])

  // --- Ref pra cancelamento compartilhado ---
  const cancelledRef = useRef(false)

  // --- Falar mensagens novas do assistente ---
  const spokenIdsRef = useRef<Set<string>>(new Set())
  const messages = useJarvisStore((s) => s.messages)
  const prevMsgLenRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length === prevMsgLenRef.current) return
    prevMsgLenRef.current = messages.length

    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || !last.content) return
    if (spokenIdsRef.current.has(last.id)) return

    spokenIdsRef.current.add(last.id)
    ttsRef.current.cancel()
    // Setar 'speaking' imediatamente pra não piscar idle entre a mensagem chegar e o áudio tocar
    setState('speaking')
    ttsRef.current.speak(last.content)
  }, [messages, setState])

  // --- Limpar erro após 4s ---
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  // --- Timer de thinking (mostra tempo decorrido após 5s) ---
  const [thinkingTime, setThinkingTime] = useState(0)
  useEffect(() => {
    if (state !== 'thinking') { setThinkingTime(0); return }
    const start = Date.now()
    const id = setInterval(() => setThinkingTime(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [state])

  // --- Handlers ---
  const handleMicClick = () => {
    if (state === 'idle') {
      ttsRef.current.cancel()
      setError('')
      setTranscript('')
      transcriptRef.current = ''
      sendingRef.current = false
      startAudio()
      stt.start()
      vad.start()
      setState('listening')
    }
  }

  const handleDiscard = () => {
    stt.abort()
    stopAudio()
    vad.stop()
    setTranscript('')
    transcriptRef.current = ''
    sendingRef.current = false
    setState('idle')
  }

  const handleSend = () => doSend()

  const handleCancel = useCallback(() => {
    ttsRef.current.cancel()
    setState('idle')
  }, [setState])

  const handleInterrupt = useCallback(() => {
    ttsRef.current.cancel()
    setState('idle')
  }, [setState])

  // --- Wake word: prioridade nativa (OpenWakeWord) > Web Speech API ---
  const [nativeWakeWordReady, setNativeWakeWordReady] = useState(false)
  useEffect(() => {
    // Check immediately and retry every 5s until found
    let mounted = true
    const check = () => {
      checkNativeWakeWord().then((ready) => {
        if (!mounted) return
        setNativeWakeWordReady(ready)
        if (!ready) setTimeout(check, 5000)
      })
    }
    check()
    return () => { mounted = false }
  }, [])

  const wakeWordCallback = useCallback(() => {
    console.log('[WakeWord] Detectado!')
    if (useJarvisStore.getState().state === 'idle') {
      handleMicClick()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Native wake word (OpenWakeWord service — works everywhere, even in Tauri)
  // Stays connected always; checks idle state internally on detection
  useNativeWakeWord({
    enabled: nativeWakeWordReady,
    onWake: wakeWordCallback,
  })

  // Fallback: Web Speech API wake word (browser only, not in Tauri)
  useWakeWord({
    enabled: !nativeWakeWordReady && state === 'idle' && !IN_TAURI,
    onWake: wakeWordCallback,
  })

  const leftAction = getLeftAction(state, handleCancel)
  const rightAction = getRightAction(state, handleInterrupt)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      paddingBottom: 130,
    }}>
      {/* Plate radial atrás do orb + drag overlay */}
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
        {/* Overlay circular pra drag-to-rotate do orb */}
        <div
          style={{
            position: 'absolute',
            width: '70%',
            height: '70%',
            borderRadius: '50%',
            cursor: 'grab',
            zIndex: 5,
            touchAction: 'none',
          }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId)
            ;(e.target as HTMLElement).style.cursor = 'grabbing'
            orbDragStart(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => orbDragMove(e.clientX, e.clientY)}
          onPointerUp={(e) => {
            (e.target as HTMLElement).style.cursor = 'grab'
            orbDragEnd()
          }}
          onPointerLeave={() => orbDragEnd()}
        />
      </div>

      {/* HUD: painéis de status nos lados do orb */}
      <ToolHUD executions={toolExecutions} />
      {/* Terminal: log de execuções na esquerda */}
      <TerminalFeed executions={toolExecutions} />
      {/* Artifact: dados estruturados na direita (lê do store) */}
      <DataArtifact />

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
            : streamingText || (state === 'thinking' && fillerText) || VOICE_PROMPTS[state]}
        </p>

        {/* Timer de thinking */}
        {state === 'thinking' && thinkingTime >= 5 && (
          <p style={{
            fontSize: 12,
            fontFamily: 'var(--f-mono)',
            color: 'var(--t-low)',
            marginTop: 8,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {thinkingTime}s
          </p>
        )}

        {/* Tool execution feedback agora aparece como artifacts ao redor do orb */}

        {/* Feedback de erro */}
        {error && (
          <p style={{
            fontSize: 13,
            color: 'var(--st-error)',
            marginTop: 8,
            opacity: 0.85,
          }}>
            {error}
          </p>
        )}
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

        {/* Container do mic + cápsula */}
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

function getLeftAction(state: JarvisState, onCancel: () => void) {
  if (state === 'thinking' || state === 'executing') {
    return { label: DOCK.cancel, onClick: onCancel }
  }
  return null
}

function getRightAction(state: JarvisState, onInterrupt: () => void) {
  if (state === 'speaking') {
    return { label: DOCK.interrupt, onClick: onInterrupt }
  }
  if (state === 'error') {
    return { label: DOCK.retry, onClick: () => useJarvisStore.getState().setState('thinking') }
  }
  if (state === 'offline') {
    return { label: DOCK.reconnect, onClick: () => useJarvisStore.getState().setState('idle') }
  }
  return null
}
