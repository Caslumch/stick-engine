/**
 * Bus de áudio compartilhado para TTS.
 *
 * O TTS conecta sua saída aqui (source -> analyser -> destination).
 * O OrbBridge lê o stream do analyser pra reagir ao áudio real.
 *
 * Um único AudioContext reutilizado pra evitar leaks.
 */

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let streamDest: MediaStreamAudioDestinationNode | null = null

export function getTTSBus() {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
    analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.75

    // Criar um MediaStream da saída pra o OrbBridge consumir
    streamDest = ctx.createMediaStreamDestination()

    // Analyser -> destination (speaker) + streamDest (pro orb)
    analyser.connect(ctx.destination)
    analyser.connect(streamDest)
  }

  return {
    ctx: ctx!,
    /** Conectar source aqui — vai pro speaker e pro orb */
    input: analyser!,
    /** Stream do áudio TTS pra o OrbBridge */
    stream: streamDest!.stream,
  }
}

/** Suspender/resumir o contexto */
export async function resumeTTSBus() {
  if (ctx?.state === 'suspended') await ctx.resume()
}

/** Checa se tem áudio tocando no bus (amplitude > threshold) */
export function isTTSPlaying(threshold = 0.01): boolean {
  if (!analyser) return false
  const data = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length) > threshold
}
