import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
  closeOnOverlay?: boolean
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  hideCloseButton?: boolean
}

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
} as const

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className = '',
  closeOnOverlay = true,
  size = 'md',
  footer,
  hideCloseButton = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (closeOnOverlay && e.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      dialogRef.current?.close()
    }
  }

  const hasHeader = title || !hideCloseButton

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-describedby={description ? 'modal-description' : undefined}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      className={`
        m-auto backdrop:bg-black/50 rounded-2xl p-0 border-0 shadow-2xl
        ${SIZE_CLASSES[size]} w-[calc(100%-2rem)]
        max-h-[calc(100vh-2rem)]
        open:animate-in open:fade-in open:zoom-in-95
        [&::backdrop]:bg-black/50
        bg-white dark:bg-[#162420]
        ${className}
      `.trim()}
    >
      <div className="flex flex-col max-h-[calc(100vh-2rem)]">
        {hasHeader && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-0 shrink-0">
            <div className="min-w-0">
              {title && (
                <h2 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">{title}</h2>
              )}
              {description && (
                <p id="modal-description" className="text-sm text-gray-500 dark:text-white/40 mt-0.5">{description}</p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                onClick={() => dialogRef.current?.close()}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 cursor-pointer shrink-0"
                aria-label="Cerrar"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
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
            )}
          </div>
        )}

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        {footer && (
          <div className="px-6 pb-6 pt-0 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
