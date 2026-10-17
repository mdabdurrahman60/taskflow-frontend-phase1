import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { ToastContext } from './toastContext'

const STYLES = {
  success: { icon: CheckCircle2, color: 'text-emerald-600' },
  error: { icon: XCircle, color: 'text-brand-600' },
  info: { icon: Info, color: 'text-sky-600' },
}

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    ({ title, description, type = 'success', duration = 3500 }) => {
      const id = nextId++
      setToasts((t) => [...t, { id, title, description, type }])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const { icon: Icon, color } = STYLES[t.type] ?? STYLES.info
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-white p-3 shadow-pop"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-faint hover:bg-surface-2 hover:text-ink-2"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
