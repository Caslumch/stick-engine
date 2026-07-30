import * as THREE from 'three'

export type AgentState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'executing'
  | 'error'
  | 'offline'

/**
 * Cada estado é só um conjunto de parâmetros. A animação em si é procedural —
 * o shader lê esses valores interpolados, nunca há troca instantânea.
 */
/**
 * Parâmetros de forma e movimento do orb — o orb NÃO é dono de cor.
 * Cor vem por props (primaryColor/secondaryColor), derivada de --accent pela bridge.
 */
export type OrbParams = {
  /** amplitude do noise de deformação */
  noiseAmp: number
  /** frequência espacial do noise: valores altos = ondulações menores e mais caóticas */
  noiseFreq: number
  /** velocidade de evolução do noise no tempo */
  noiseSpeed: number
  /** raio base da esfera */
  radius: number
  /** amplitude do ciclo de "respiração" */
  breathAmp: number
  /** período da respiração, em segundos */
  breathPeriod: number
  /** intensidade do brilho/emissão */
  glow: number
  /** quanto o volume do áudio deforma a superfície (0 = ignora áudio) */
  audioReactivity: number
  /** rotação automática, em rad/s */
  spin: number
}

export const STATES: Record<AgentState, OrbParams> = {
  idle: {
    noiseAmp: 0.09,
    noiseFreq: 1.6,
    noiseSpeed: 0.16,
    radius: 1.0,
    breathAmp: 0.045,
    breathPeriod: 7,
    glow: 0.55,
    audioReactivity: 0,
    spin: 0.05,
  },
  listening: {
    noiseAmp: 0.14,
    noiseFreq: 2.0,
    noiseSpeed: 0.35,
    radius: 1.1,
    breathAmp: 0.05,
    breathPeriod: 4,
    glow: 0.85,
    audioReactivity: 0.85,
    spin: 0.1,
  },
  thinking: {
    noiseAmp: 0.34,
    noiseFreq: 3.4,
    noiseSpeed: 1.15,
    radius: 1.02,
    breathAmp: 0.03,
    breathPeriod: 3,
    glow: 0.95,
    audioReactivity: 0,
    spin: 0.4,
  },
  speaking: {
    noiseAmp: 0.16,
    noiseFreq: 2.6,
    noiseSpeed: 0.6,
    radius: 1.06,
    breathAmp: 0.02,
    breathPeriod: 3,
    glow: 1.25,
    audioReactivity: 1.5,
    spin: 0.14,
  },
  executing: {
    noiseAmp: 0.22,
    noiseFreq: 4.2,
    noiseSpeed: 1.6,
    radius: 1.04,
    breathAmp: 0.06,
    breathPeriod: 1.2,
    glow: 1.1,
    audioReactivity: 0,
    spin: 0.6,
  },
  error: {
    noiseAmp: 0.4,
    noiseFreq: 5.5,
    noiseSpeed: 2.4,
    radius: 0.98,
    breathAmp: 0.09,
    breathPeriod: 0.8,
    glow: 1.2,
    audioReactivity: 0,
    spin: 0.2,
  },
  offline: {
    noiseAmp: 0.05,
    noiseFreq: 1.2,
    noiseSpeed: 0.06,
    radius: 0.82,
    breathAmp: 0.02,
    breathPeriod: 11,
    glow: 0.14,
    audioReactivity: 0,
    spin: 0.015,
  },
}

/** Interpola dois conjuntos de parâmetros — usado na transição entre estados. */
export function lerpParams(a: OrbParams, b: OrbParams, t: number): OrbParams {
  const l = (x: number, y: number) => x + (y - x) * t
  return {
    noiseAmp: l(a.noiseAmp, b.noiseAmp),
    noiseFreq: l(a.noiseFreq, b.noiseFreq),
    noiseSpeed: l(a.noiseSpeed, b.noiseSpeed),
    radius: l(a.radius, b.radius),
    breathAmp: l(a.breathAmp, b.breathAmp),
    breathPeriod: l(a.breathPeriod, b.breathPeriod),
    glow: l(a.glow, b.glow),
    audioReactivity: l(a.audioReactivity, b.audioReactivity),
    spin: l(a.spin, b.spin),
  }
}
