import { useState, useEffect, type ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  variant?: ToastVariant
  title?: string
  children: ReactNode
  duration?: number
  onClose?: () => void
  className?: string
}

const variantStyles: Record<ToastVariant, { container: string; icon: string }> = {
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: '✓',
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: '✕',
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: 'i',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: '!',
  },
}

export default function Toast({
  variant = 'info',
  title,
  children,
  duration = 5000,
  onClose,
  className = '',
}: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (duration <= 0) return

    const timer = setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!visible) return null

  const styles = variantStyles[variant]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-start gap-3 p-4 rounded-xl border shadow-sm
        animate-in slide-in-from-right fade-in duration-200
        ${styles.container}
        ${className}
      `.trim()}
    >
      <span
        className="flex-shrink-0 w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-xs font-black mt-0.5"
        aria-hidden="true"
      >
        {styles.icon}
      </span>

      <div className="flex-1 min-w-0">
        {title && <p className="font-bold text-sm">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>

      <button
        onClick={() => {
          setVisible(false)
          onClose?.()
        }}
        className="flex-shrink-0 p-0.5 rounded hover:bg-current/10 transition-colors cursor-pointer"
        aria-label="Cerrar notificación"
        type="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
