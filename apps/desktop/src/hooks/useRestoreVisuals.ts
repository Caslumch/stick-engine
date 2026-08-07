import { useEffect } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'

/**
 * Restaura configurações visuais (accent, background, blur, dim)
 * salvas no banco quando o app inicia.
 */
export function useRestoreVisuals() {
  const settings = useJarvisStore((s) => s.settings)

  useEffect(() => {
    // Só rodar quando settings estiverem carregadas do backend
    if (!settings || Object.keys(settings).length === 0) return

    const accent = settings['ui.accent']
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent)
      const n = parseInt(accent.slice(1), 16)
      if (!isNaN(n)) {
        document.documentElement.style.setProperty('--accent-rgb',
          `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`)
      }
    }

    const blur = settings['ui.bgBlur']
    if (blur) document.documentElement.style.setProperty('--bg-blur', blur + 'px')

    const dim = settings['ui.bgDim']
    if (dim) document.documentElement.style.setProperty('--bg-dim', String(parseInt(dim, 10) / 100))

    const bgPreset = settings['ui.bgPreset']
    if (bgPreset && bgPreset !== 'none') {
      document.documentElement.style.setProperty('--bg-img', bgPreset)
      document.documentElement.style.setProperty('--blob-op', '.35')
      const photo = document.querySelector('.backdrop-photo') as HTMLElement | null
      if (photo) photo.setAttribute('data-active', '')
    }
  // Rodar uma vez quando settings carregam
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(settings).length > 0])
}
