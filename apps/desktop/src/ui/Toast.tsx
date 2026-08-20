import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { dur } from '../motion/tokens'

/* ----------------------------------------------------------------
   Toast — notificação sutil de sucesso/erro.
   ---------------------------------------------------------------- */

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error'
}

let addToastFn: ((message: string, type: 'success' | 'error') => void) | null = null

/** Mostra um toast de qualquer lugar */
export function showToast(message: string, type: 'success' | 'error' = 'success') {
  addToastFn?.(message, type)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev.slice(-3), { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 300,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: dur.base }}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--r-pill)',
              background: t.type === 'success' ? 'rgba(40, 200, 64, .15)' : 'rgba(255, 107, 107, .15)',
              border: `1px solid ${t.type === 'success' ? 'rgba(40, 200, 64, .3)' : 'rgba(255, 107, 107, .3)'}`,
              backdropFilter: 'blur(12px)',
              color: t.type === 'success' ? '#28C840' : 'var(--st-error)',
              fontSize: 13,
              fontFamily: 'var(--f)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {t.type === 'success' ? '✓' : '✗'} {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
