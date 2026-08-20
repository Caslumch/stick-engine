import { useEffect, useRef } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'

/**
 * Restaura configurações visuais (accent, background, blur, dim)
 * salvas no banco quando o app inicia.
 * Tenta até encontrar o elemento .backdrop-photo no DOM.
 */
export function useRestoreVisuals() {
  const settings = useJarvisStore((s) => s.settings)
  const appliedRef = useRef(false)

  useEffect(() => {
    if (appliedRef.current) return
    if (!settings || Object.keys(settings).length === 0) return

    // Accent
    const accent = settings['ui.accent']
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent)
      const n = parseInt(accent.slice(1), 16)
      if (!isNaN(n)) {
        document.documentElement.style.setProperty('--accent-rgb',
          `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`)
      }
    }

    // Blur & Dim
    const blur = settings['ui.bgBlur']
    if (blur) document.documentElement.style.setProperty('--bg-blur', blur + 'px')

    const dim = settings['ui.bgDim']
    if (dim) document.documentElement.style.setProperty('--bg-dim', String(parseInt(dim, 10) / 100))

    // Background — tentar aplicar, se o DOM não estiver pronto, retry
    const bgPreset = settings['ui.bgPreset']
    if (bgPreset && bgPreset !== 'none') {
      const applyBg = () => {
        document.documentElement.style.setProperty('--bg-img', bgPreset)
        document.documentElement.style.setProperty('--blob-op', '.35')
        const photo = document.querySelector('.backdrop-photo') as HTMLElement | null
        if (photo) {
          photo.setAttribute('data-active', '')
          return true
        }
        return false
      }

      if (!applyBg()) {
        // Retry a cada 200ms até encontrar o elemento (max 3s)
        let attempts = 0
        const interval = setInterval(() => {
          attempts++
          if (applyBg() || attempts > 15) clearInterval(interval)
        }, 200)
      }
    }

    appliedRef.current = true
  }, [settings])
}
