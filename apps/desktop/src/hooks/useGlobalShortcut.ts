import { useEffect } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'

const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Registra um global hotkey (Ctrl+Shift+J) para mostrar/esconder a janela.
 * Só funciona no Tauri — no browser é no-op.
 */
export function useGlobalShortcut() {
  useEffect(() => {
    if (!IN_TAURI) return

    let cleanup: (() => void) | undefined

    const setup = async () => {
      try {
        const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut')
        const { getCurrentWindow } = await import('@tauri-apps/api/window')

        const shortcut = 'CmdOrCtrl+Shift+J'

        await register(shortcut, async (event) => {
          if (event.state === 'Pressed') {
            const win = getCurrentWindow()
            const visible = await win.isVisible()
            if (visible) {
              await win.hide()
            } else {
              await win.show()
              await win.unminimize()
              await win.setFocus()
            }
          }
        })

        console.log('[GlobalShortcut] Registered:', shortcut)

        cleanup = () => {
          unregister(shortcut).catch(() => {})
        }
      } catch (err) {
        console.warn('[GlobalShortcut] Failed to register:', err)
      }
    }

    setup()

    return () => {
      cleanup?.()
    }
  }, [])
}
