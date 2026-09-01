/**
 * Sons sutis de UI — gerados via Web Audio API (sem arquivos).
 * Toca um beep curto pra feedback de ações.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

/** Som sutil de "enviado" — blip curto ascendente */
export function playSendSound() {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, c.currentTime)
    osc.frequency.linearRampToValueAtTime(900, c.currentTime + 0.08)
    gain.gain.setValueAtTime(0.08, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12)

    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.12)
  } catch { /* silent fail */ }
}

/** Som sutil de "ouvindo" — blip suave */
export function playListeningSound() {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, c.currentTime)
    osc.frequency.linearRampToValueAtTime(520, c.currentTime + 0.06)
    gain.gain.setValueAtTime(0.06, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1)

    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.1)
  } catch { /* silent fail */ }
}

/**
 * Som de inicialização — "power-up" sintético.
 *
 * Três camadas sobrepostas, sem arquivo de áudio:
 *  1. sweep ascendente (o sistema "acordando")
 *  2. acorde que abre em quinta+oitava (resolução, sensação de pronto)
 *  3. brilho curto de ruído filtrado (o "shimmer" futurista)
 */
export function playBootSound() {
  try {
    const c = getCtx()
    const t = c.currentTime
    const master = c.createGain()
    master.gain.value = 0.9
    master.connect(c.destination)

    // 1. Sweep ascendente — 110Hz -> 880Hz, com filtro abrindo junto
    const sweep = c.createOscillator()
    const sweepGain = c.createGain()
    const sweepFilter = c.createBiquadFilter()
    sweepFilter.type = 'lowpass'
    sweepFilter.frequency.setValueAtTime(300, t)
    sweepFilter.frequency.exponentialRampToValueAtTime(4000, t + 0.5)
    sweepFilter.Q.value = 6
    sweep.type = 'sawtooth'
    sweep.frequency.setValueAtTime(110, t)
    sweep.frequency.exponentialRampToValueAtTime(880, t + 0.5)
    sweepGain.gain.setValueAtTime(0.0001, t)
    sweepGain.gain.exponentialRampToValueAtTime(0.07, t + 0.18)
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62)
    sweep.connect(sweepFilter); sweepFilter.connect(sweepGain); sweepGain.connect(master)
    sweep.start(t); sweep.stop(t + 0.65)

    // 2. Acorde que resolve — entra escalonado (raiz, quinta, oitava)
    const chord = [
      { freq: 440, delay: 0.30 },
      { freq: 660, delay: 0.38 },
      { freq: 880, delay: 0.46 },
    ]
    for (const { freq, delay } of chord) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, t + delay)
      gain.gain.setValueAtTime(0.0001, t + delay)
      gain.gain.exponentialRampToValueAtTime(0.05, t + delay + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.75)
      osc.connect(gain); gain.connect(master)
      osc.start(t + delay); osc.stop(t + delay + 0.8)
    }

    // 3. Shimmer — ruído branco passado por bandpass alto e agudo
    const noiseLen = Math.floor(c.sampleRate * 0.35)
    const buffer = c.createBuffer(1, noiseLen, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) {
      // decai ao longo do buffer pra virar um "tsss" curto
      data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
    }
    const noise = c.createBufferSource()
    noise.buffer = buffer
    const noiseFilter = c.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(2000, t + 0.28)
    noiseFilter.frequency.exponentialRampToValueAtTime(7000, t + 0.62)
    noiseFilter.Q.value = 1.2
    const noiseGain = c.createGain()
    noiseGain.gain.setValueAtTime(0.0001, t + 0.28)
    noiseGain.gain.exponentialRampToValueAtTime(0.035, t + 0.36)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.66)
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master)
    noise.start(t + 0.28)
  } catch { /* silent fail */ }
}

/** Som de "recebido" — blip descendente */
export function playReceiveSound() {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, c.currentTime)
    osc.frequency.linearRampToValueAtTime(500, c.currentTime + 0.1)
    gain.gain.setValueAtTime(0.06, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)

    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.15)
  } catch { /* silent fail */ }
}
