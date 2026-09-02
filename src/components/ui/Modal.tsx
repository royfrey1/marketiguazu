import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  closeOnOverlay?: boolean
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  className = '',
  closeOnOverlay = true,
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

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      className={`
        backdrop:bg-black/50 rounded-2xl p-0 border-0 shadow-2xl
        max-w-lg w-[calc(100%-2rem)]
        open:animate-in open:fade-in open:zoom-in-95
        [&::backdrop]:bg-black/50
        ${className}
      `.trim()}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 className="text-lg font-black text-gray-800">{title}</h2>
          )}
          <button
              onClick={() => dialogRef.current?.close()}
              className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
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
        </div>
        {children}
      </div>
    </dialog>
  )
}
