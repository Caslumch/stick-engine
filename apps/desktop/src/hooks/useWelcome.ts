import { useEffect, useRef } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'

/**
 * Saudação inteligente ao abrir o app.
 * Detecta: novo dia, retorno, primeira vez.
 * Adiciona mensagem do assistente como se ele te recebesse.
 */

const STORAGE_KEY = 'jarvis-lastVisit'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function useWelcome() {
  const messages = useJarvisStore((s) => s.messages)
  const addMessage = useJarvisStore((s) => s.addMessage)
  const connected = useJarvisStore((s) => s.connected)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current || !connected) return
    // Só rodar uma vez quando conectar
    if (messages.length > 0) return // já tem conversa ativa

    ranRef.current = true

    const lastVisit = localStorage.getItem(STORAGE_KEY)
    const today = new Date().toDateString()
    const isNewDay = lastVisit !== today

    localStorage.setItem(STORAGE_KEY, today)

    if (isNewDay) {
      const greeting = getGreeting()
      // Delay pra não competir com o socket init
      setTimeout(() => {
        addMessage({
          id: 'welcome-' + Date.now(),
          conversationId: 'welcome',
          role: 'assistant',
          content: `${greeting}, Lucas! Como posso te ajudar hoje?`,
          createdAt: new Date().toISOString(),
        })
      }, 800)
    }
  }, [connected, messages.length, addMessage])
}
