import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'dark' | 'light' | 'auto'

interface ThemeContextValue {
  mode: ThemeMode
  resolved: 'dark' | 'light'
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'stick-theme'
const MQ = '(prefers-color-scheme: light)'

function resolve(mode: ThemeMode, systemLight: boolean): 'dark' | 'light' {
  if (mode === 'auto') return systemLight ? 'light' : 'dark'
  return mode
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeRaw] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'auto') return stored
    return 'dark'
  })

  const [systemLight, setSystemLight] = useState(() => window.matchMedia(MQ).matches)

  useEffect(() => {
    const mq = window.matchMedia(MQ)
    const handler = (e: MediaQueryListEvent) => setSystemLight(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolved = resolve(mode, systemLight)

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setMode = useCallback((m: ThemeMode) => {
    setModeRaw(m)
    localStorage.setItem(STORAGE_KEY, m)
  }, [])

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setMode])

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
