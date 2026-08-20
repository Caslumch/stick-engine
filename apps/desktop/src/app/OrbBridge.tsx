import { useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useJarvisStore } from '../stores/jarvis.store'
import { useTheme } from '../theme/ThemeProvider'
import { JarvisOrb } from '../orb/JarvisOrb'
import { useAudioAnalyser } from '../orb/hooks/useAudioAnalyser'
import { getTTSBus } from '../hooks/ttsAudioBus'
import type { AudioSource } from '../orb/hooks/useAudioAnalyser'
import type { JarvisState } from '@jarvis/shared'

const STATE_COLORS: Record<JarvisState, { primary: string; secondary: string }> = {
  idle:      { primary: '#4ADFB0', secondary: '#1A7A5A' },
  listening: { primary: '#57C8FF', secondary: '#1A6A9A' },
  thinking:  { primary: '#8B7BFF', secondary: '#4338CA' },
  executing: { primary: '#A6F05A', secondary: '#4A8A1A' },
  speaking:  { primary: '#7DD3FC', secondary: '#C4B5FD' },
  error:     { primary: '#FF6B6B', secondary: '#7F1D1D' },
  offline:   { primary: '#8A968F', secondary: '#374151' },
}

export function OrbBridge() {
  const state = useJarvisStore((s) => s.state)
  const view = useJarvisStore((s) => s.view)
  const isAmbient = useJarvisStore((s) => s.isAmbient)
  const { resolved } = useTheme()
  const colors = STATE_COLORS[state]
  const visible = view === 'voice' || isAmbient
  const isLight = resolved === 'light'

  // Áudio: listening usa mic, speaking usa o stream real do TTS
  const source = useMemo<AudioSource>(() => {
    if (state === 'listening') return { kind: 'mic' }
    if (state === 'speaking') {
      const bus = getTTSBus()
      return { kind: 'stream', stream: bus.stream }
    }
    return { kind: 'none' }
  }, [state])
  const audio = useAudioAnalyser(source)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: isAmbient ? 49 : 2,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transform: isAmbient ? 'scale(1.45)' : 'none',
        transition: 'opacity .26s linear, transform .8s var(--sp-morph)',
      }}
    >
      <Canvas
        dpr={[1.5, 2]}
        frameloop="always"
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
        camera={{ position: [0, 0, 4.2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={(s) => {
          s.gl.setClearColor(0x000000, 0)
        }}
      >
        <JarvisOrb
          state={state}
          pointCount={18000}
          pointSize={4.5}
          primaryColor={colors.primary}
          secondaryColor={colors.secondary}
          lightMode={isLight}
          audio={audio}
        />
        <EffectComposer>
          <Bloom
            intensity={isLight ? 0.45 : 0.55}
            luminanceThreshold={isLight ? 0.5 : 0.5}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
        </EffectComposer>
        <CanvasLifecycleLogger />
      </Canvas>
    </div>
  )
}

function CanvasLifecycleLogger() {
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      console.log('[OrbBridge] Canvas mounted')
      mounted.current = true
    }
    return () => {
      console.warn('[OrbBridge] Canvas UNMOUNTED — this should not happen during navigation!')
    }
  }, [])
  return null
}
