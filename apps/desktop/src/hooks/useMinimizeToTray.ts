import { useEffect } from 'react'

const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Intercepta o evento de fechar a janela e minimiza pro tray em vez de sair.
 * Só funciona no Tauri — no browser é no-op.
 */
export function useMinimizeToTray() {
  useEffect(() => {
    if (!IN_TAURI) return

    let unlisten: (() => void) | undefined

    const setup = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()

        unlisten = await win.onCloseRequested(async (event) => {
          // Previne o fechamento — só esconde a janela
          event.preventDefault()
          await win.hide()
        })

        console.log('[MinimizeToTray] Close intercepted — will hide to tray')
      } catch (err) {
        console.warn('[MinimizeToTray] Failed to setup:', err)
      }
    }

    setup()

    return () => {
      unlisten?.()
    }
  }, [])
}
