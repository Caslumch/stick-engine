import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { orbDrag } from './orbDrag'

import { AgentState, OrbParams, STATES, lerpParams } from './config/states'
import { AudioFeatures } from './hooks/useAudioAnalyser'

import meshVert from './shaders/mesh.vert.glsl'
import meshFrag from './shaders/mesh.frag.glsl'
import pointsVert from './shaders/points.vert.glsl'
import pointsFrag from './shaders/points.frag.glsl'
import fluidVert from './shaders/fluid.vert.glsl'
import fluidFrag from './shaders/fluid.frag.glsl'
import blobsFrag from './shaders/blobs.frag.glsl'
import logogramFrag from './shaders/logogram.frag.glsl'

export type OrbVariant = 'points' | 'mesh' | 'fluid' | 'blobs' | 'logogram'

/** Variantes que são billboards 2D: silhueta recortada no fragment shader. */
const BILLBOARD: OrbVariant[] = ['fluid', 'blobs', 'logogram']

/** Estas desenham o próprio fundo (claro), então o canvas não deve ficar preto. */
export const LIGHT_BACKGROUND: OrbVariant[] = ['blobs', 'logogram']

export type JarvisOrbProps = {
  state: AgentState
  variant?: OrbVariant
  /** ref vindo de useAudioAnalyser; opcional — sem ele a orb só respira */
  audio?: React.RefObject<AudioFeatures>
  /** nº de pontos no modo point cloud */
  pointCount?: number
  pointSize?: number
  /** segundos para completar a transição entre estados */
  transitionDuration?: number
  /** cor primária — derivada de --accent pela bridge */
  primaryColor: string
  /** cor secundária — versão mais escura da primária */
  secondaryColor: string
  /** tema claro: NormalBlending, cor escurecida ~0.42x, alfa ~1.85x (DS seção 4) */
  lightMode?: boolean
}

/** Distribui N pontos uniformemente numa esfera (espiral de Fibonacci). */
function fibonacciSphere(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    positions[i * 3] = Math.cos(theta) * radius
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(theta) * radius
  }
  return positions
}

function makeUniforms(pointSize: number, dpr: number) {
  return {
    uTime: { value: 0 },
    uNoiseAmp: { value: 0 },
    uNoiseFreq: { value: 0 },
    uNoiseSpeed: { value: 0 },
    uRadius: { value: 1 },
    uBreathAmp: { value: 0 },
    uBreathPeriod: { value: 6 },
    uAudioReactivity: { value: 0 },
    uVolume: { value: 0 },
    uPitch: { value: 0.5 },
    uEnergy: { value: 0 },
    uPrimary: { value: new THREE.Color('#3B82F6') },
    uSecondary: { value: new THREE.Color('#1E3A8A') },
    uGlow: { value: 1 },
    uOpacity: { value: 1 },
    uPointSize: { value: pointSize },
    uPixelRatio: { value: Math.min(dpr, 2) },
    uAspect: { value: new THREE.Vector2(1, 1) },
  }
}

/** Escreve os valores nos uniforms do material — via ref direto, nunca desconecta. */
function setUniforms(mat: THREE.ShaderMaterial | null, p: OrbParams, dt: number, opts: {
  audio?: React.RefObject<AudioFeatures>
  pointSize: number
  primaryColor: string
  secondaryColor: string
  lightMode?: boolean
}) {
  if (!mat) return
  const u = mat.uniforms
  u.uTime.value += dt
  u.uNoiseAmp.value = p.noiseAmp
  u.uNoiseFreq.value = p.noiseFreq
  u.uNoiseSpeed.value = p.noiseSpeed
  u.uRadius.value = p.radius
  u.uBreathAmp.value = p.breathAmp
  u.uBreathPeriod.value = p.breathPeriod
  u.uAudioReactivity.value = p.audioReactivity
  u.uVolume.value = opts.audio?.current?.volume ?? 0
  u.uPitch.value = opts.audio?.current?.pitch ?? 0.5
  u.uEnergy.value = opts.audio?.current?.energy ?? 0
  u.uGlow.value = p.glow
  u.uPointSize.value = opts.pointSize
  u.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
  u.uAspect.value.set(1, 1)

  u.uPrimary.value.set(opts.primaryColor)
  u.uSecondary.value.set(opts.secondaryColor)

  // Tema claro: escurece a cor ~0.42x para compensar o NormalBlending (DS seção 4)
  if (opts.lightMode) {
    u.uPrimary.value.multiplyScalar(0.42)
    u.uSecondary.value.multiplyScalar(0.42)
  }

  // Trocar blending em runtime requer setar direto no material
  const wantedBlending = opts.lightMode ? THREE.NormalBlending : THREE.AdditiveBlending
  if (mat.blending !== wantedBlending) {
    mat.blending = wantedBlending
    mat.needsUpdate = true
  }
}

export function JarvisOrb({
  state,
  variant = 'points',
  audio,
  pointCount = 60000,
  pointSize = 2.4,
  transitionDuration = 0.9,
  primaryColor,
  secondaryColor,
  lightMode = false,
}: JarvisOrbProps) {
  const groupRef = useRef<THREE.Group>(null)
  // Ref direto ao material — atualizar uniforms por aqui garante que nunca
  // desconecta, independente de StrictMode / R3F reconciler.
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { size, viewport } = useThree()

  // Drag-to-rotate — lê do orbDrag (escrito pelo Voice overlay)

  const transition = useRef({
    from: STATES[state],
    to: STATES[state],
    t: 1,
    current: STATES[state] as OrbParams,
    lastState: state,
  })

  const initialUniforms = useMemo(
    () => makeUniforms(pointSize, viewport.dpr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const pointPositions = useMemo(() => fibonacciSphere(pointCount), [pointCount])

  const pointsGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.5)
    return g
  }, [pointPositions])

  useFrame((_, delta) => {
    const tr = transition.current
    const dt = Math.min(delta, 0.1)

    if (state !== tr.lastState) {
      tr.from = tr.current
      tr.to = STATES[state]
      tr.t = 0
      tr.lastState = state
    }

    if (tr.t < 1) {
      tr.t = Math.min(1, tr.t + dt / Math.max(transitionDuration, 0.001))
      const e = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - (-2 * tr.t + 2) ** 3 / 2
      tr.current = lerpParams(tr.from, tr.to, e)
    } else {
      tr.current = tr.to
    }

    // Atualiza via ref do material — nunca desconecta
    setUniforms(matRef.current, tr.current, dt, {
      audio, pointSize, primaryColor, secondaryColor, lightMode,
    })

    if (groupRef.current && !BILLBOARD.includes(variant)) {
      const d = orbDrag

      if (d.active) {
        groupRef.current.rotation.y = d.userY
        groupRef.current.rotation.x = d.userX
      } else {
        // Inércia
        d.velX *= 0.94
        d.velY *= 0.94
        if (Math.abs(d.velX) > 0.0005 || Math.abs(d.velY) > 0.0005) {
          d.userY += d.velY
          d.userX += d.velX
          d.userX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, d.userX))
          groupRef.current.rotation.y = d.userY
          groupRef.current.rotation.x = d.userX
        } else {
          // Retornar suavemente à rotação automática
          const autoY = groupRef.current.rotation.y + tr.current.spin * dt
          const autoX = Math.sin((matRef.current?.uniforms.uTime.value ?? 0) * 0.12) * 0.1
          d.userY += (autoY - d.userY) * 0.02
          d.userX += (autoX - d.userX) * 0.02
          groupRef.current.rotation.y = d.userY
          groupRef.current.rotation.x = d.userX
        }
      }
    }
  })

  const fullscreen = LIGHT_BACKGROUND.includes(variant)
  const scale = fullscreen ? 1 : Math.min(1, size.width / 900)

  const side = Math.min(viewport.width, viewport.height) * 1.12
  const planeH = side
  const planeW = side

  return (
    <group key={variant} ref={groupRef} scale={scale}>
      {variant === 'points' ? (
        <points geometry={pointsGeometry} frustumCulled={false}>
          <shaderMaterial
            ref={matRef}
            vertexShader={pointsVert}
            fragmentShader={pointsFrag}
            uniforms={initialUniforms}
            transparent
            depthWrite={false}
            blending={lightMode ? THREE.NormalBlending : THREE.AdditiveBlending}
          />
        </points>
      ) : BILLBOARD.includes(variant) ? (
        <mesh frustumCulled={false}>
          <planeGeometry
            args={variant === 'fluid' ? [2.6, 2.6] : [planeW, planeH]}
          />
          <shaderMaterial
            ref={matRef}
            vertexShader={fluidVert}
            fragmentShader={
              variant === 'blobs'
                ? blobsFrag
                : variant === 'logogram'
                  ? logogramFrag
                  : fluidFrag
            }
            uniforms={initialUniforms}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ) : (
        <mesh frustumCulled={false}>
          <sphereGeometry args={[1, 192, 192]} />
          <shaderMaterial
            ref={matRef}
            vertexShader={meshVert}
            fragmentShader={meshFrag}
            uniforms={initialUniforms}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={lightMode ? THREE.NormalBlending : THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  )
}
