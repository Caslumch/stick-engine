import { useEffect } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Atalhos globais de teclado — seção 12 do DESIGN_SYSTEM.md.
 * ⌘K é tratado pela CommandPalette (capture phase).
 */
export function useKeyboardShortcuts() {
  const { toggle: toggleTheme } = useTheme()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).tagName === 'INPUT' ||
                     (e.target as HTMLElement).tagName === 'TEXTAREA'

      // ⌘K já é interceptado pela CommandPalette em capture phase
      if (typing && e.key !== 'Escape') return

      const store = useJarvisStore.getState()

      switch (e.key) {
        case '1':
          store.setView('voice')
          break
        case '2':
          store.setView('chat')
          break
        case '3':
          store.setView('settings')
          break
        case 'Escape':
          if (store.state !== 'idle') store.setState('idle')
          break
        case ' ':
          e.preventDefault()
          // Disparar evento customizado — o Voice.tsx escuta e inicia/envia gravação
          if (store.view === 'voice') {
            window.dispatchEvent(new CustomEvent('jarvis:space'))
          }
          break
      }

      if (e.key.toLowerCase() === 't') toggleTheme()
      if (e.key.toLowerCase() === 'a') {
        store.setAmbient(!store.isAmbient)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleTheme])
}
