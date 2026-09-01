/**
 * Ponte de logs do frontend para o terminal da API.
 *
 * No Tauri o console do WebView só aparece abrindo o DevTools. Aqui as
 * mensagens saem junto do `pnpm dev:tauri`, onde já saem os logs da API.
 */

const API = 'http://localhost:3000'

type Nivel = 'log' | 'warn' | 'error'

// fila + flush: uma requisição por lote, senão um loop de logs viraria
// uma enxurrada de POSTs
let fila: Array<{ scope: string; message: string; level: Nivel }> = []
let agendado: ReturnType<typeof setTimeout> | null = null

function enviar() {
  agendado = null
  const lote = fila
  fila = []
  for (const item of lote) {
    fetch(`${API}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(() => {})
  }
}

function enfileirar(scope: string, message: string, level: Nivel) {
  if (!message) return
  fila.push({ scope, message: message.slice(0, 1500), level })
  if (fila.length > 40) fila.splice(0, fila.length - 40) // descarta o excesso
  if (!agendado) agendado = setTimeout(enviar, 250)
}

// Marca as mensagens que o logUI ja enfileirou, pro interceptador de
// console nao mandar a mesma linha duas vezes.
let emitindoPeloLogUI = false

/** Loga no console do WebView e espelha no terminal. */
export function logUI(message: string, scope = 'UI', level: Nivel = 'log') {
  emitindoPeloLogUI = true
  try {
    console[level](`[${scope}]`, message)
  } finally {
    emitindoPeloLogUI = false
  }
  enfileirar(scope, message, level)
}

function formatar(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a
      if (a instanceof Error) return `${a.name}: ${a.message}`
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')
}

let instalado = false

/**
 * Espelha TODO console.log/warn/error no terminal, e também erros não
 * tratados e promises rejeitadas.
 *
 * Assim qualquer parte do app aparece no terminal sem precisar trocar
 * as chamadas de console existentes uma a uma.
 */
export function instalarPonteDeLogs() {
  if (instalado || typeof window === 'undefined') return
  instalado = true

  for (const nivel of ['log', 'warn', 'error'] as const) {
    const original = console[nivel].bind(console)
    console[nivel] = (...args: unknown[]) => {
      original(...args)
      // o logUI ja enfileira a propria mensagem — sem isto ela sairia dobrada
      if (emitindoPeloLogUI) return
      enfileirar('UI', formatar(args), nivel)
    }
  }

  window.addEventListener('error', (e) => {
    enfileirar('Erro', `${e.message} (${e.filename}:${e.lineno})`, 'error')
  })

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    enfileirar('Promise', r instanceof Error ? `${r.name}: ${r.message}` : String(r), 'error')
  })
}
