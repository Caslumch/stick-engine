import { useEffect, useRef } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { playBootSound } from './uiSounds'

/**
 * Boas-vindas ao abrir o app.
 *
 * Sempre que conecta: abre uma conversa nova, toca o som de boot
 * e mostra a saudação do assistente.
 */

const STORAGE_KEY = 'jarvis-lastVisit'

/** Saudação pelo horário real da máquina. Madrugada conta como noite. */
function getGreeting(hour = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Monta a saudação. {g} = "Bom dia/Boa tarde/Boa noite", {n} = nome, {a} = agente.
 * Variadas pra não repetir sempre a mesma frase ao abrir.
 */
const TEMPLATES = [
  '{g}, {n}! Como posso ajudar?',
  'Olá, {n}. {g}! Em que posso ajudar?',
  '{g}, {n}. {a} online — no que vamos trabalhar?',
  'Olá, {n}! {a} pronto. O que você precisa?',
  '{g}, {n}! Estou por aqui. O que manda?',
  'Oi, {n}. {g}! Pronto quando você estiver.',
  '{g}, {n}. Tudo pronto por aqui — como posso ajudar?',
]

/**
 * Extrai o primeiro nome das memórias do tipo 'person'.
 * O extractImplicitMemories salva frases como "Nome é Lucas" / "Se chama Lucas".
 */
export function extractNameFromMemories(
  memories: Array<{ type: string; content: string }>,
): string {
  const patterns = [
    /\bnome\s+(?:é|e|eh)\s+([A-ZÀ-Ú][\wÀ-ú]+)/i,
    /\bse\s+chama\s+([A-ZÀ-Ú][\wÀ-ú]+)/i,
    /\bchamo[- ]me\s+([A-ZÀ-Ú][\wÀ-ú]+)/i,
    /\busu[áa]rio\s+(?:é|e)\s+([A-ZÀ-Ú][\wÀ-ú]+)/i,
  ]
  for (const m of memories) {
    if (m.type !== 'person') continue
    // ignora memórias sobre terceiros (irmão, chefe, amigo...)
    if (/\b(irm[ãa]o|irm[ãa]|pai|m[ãa]e|chefe|amigo|amiga|namorad|colega|filho|filha)\b/i.test(m.content)) continue
    for (const re of patterns) {
      const hit = m.content.match(re)
      if (hit?.[1]) return hit[1]
    }
  }
  return ''
}

function buildWelcome(userName: string, agentName: string, hour?: number): string {
  const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]
  const text = tpl
    .replace('{g}', getGreeting(hour))
    .replace('{n}', userName.trim())
    .replace('{a}', agentName)

  // Sem nome configurado, limpa a pontuação que sobra ("Olá, . Bom dia" -> "Olá! Bom dia")
  return userName.trim()
    ? text
    : text.replace(/,\s*!/g, '!').replace(/,\s*\./g, '.').replace(/\s{2,}/g, ' ').trim()
}

export function useWelcome() {
  const addMessage = useJarvisStore((s) => s.addMessage)
  const newConversation = useJarvisStore((s) => s.newConversation)
  const connected = useJarvisStore((s) => s.connected)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current || !connected) return
    ranRef.current = true

    const lastVisit = localStorage.getItem(STORAGE_KEY)
    const today = new Date().toDateString()
    const isFirstToday = lastVisit !== today
    localStorage.setItem(STORAGE_KEY, today)

    // Conversa nova a cada abertura — o histórico segue acessível na tela de Histórico
    newConversation()
    localStorage.removeItem('jarvis-conversationId')

    // O AudioContext só sai de 'suspended' após um gesto do usuário.
    // Se estiver bloqueado, o som toca no primeiro clique/tecla.
    const boot = () => {
      try { playBootSound() } catch { /* ignore */ }
    }
    const armOnGesture = () => {
      boot()
      window.removeEventListener('pointerdown', armOnGesture)
      window.removeEventListener('keydown', armOnGesture)
    }

    const showWelcome = () => {
      boot()
      window.addEventListener('pointerdown', armOnGesture, { once: true })
      window.addEventListener('keydown', armOnGesture, { once: true })

      const s = useJarvisStore.getState().settings
      const agentName = s['agent.name'] || 'Jarvis'
      const userName = s['user.name'] || ''
      const content = buildWelcome(userName, agentName)

      addMessage({
        id: 'welcome-' + Date.now(),
        conversationId: 'welcome',
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
      })
    }

    // Espera o nome chegar (settings + memória, via useSocket), com teto de 2s
    // pra saudação nunca deixar de aparecer.
    let waited = 0
    const poll = setInterval(() => {
      waited += 150
      const hasName = !!useJarvisStore.getState().settings['user.name']
      if (hasName || waited >= 2000) {
        clearInterval(poll)
        showWelcome()
      }
    }, 150)

    return () => {
      clearInterval(poll)
      window.removeEventListener('pointerdown', armOnGesture)
      window.removeEventListener('keydown', armOnGesture)
    }
  }, [connected, addMessage, newConversation])
}
