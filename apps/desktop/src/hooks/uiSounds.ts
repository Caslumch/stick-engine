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
