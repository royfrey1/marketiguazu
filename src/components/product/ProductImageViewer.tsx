import { useCallback, useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface ProductViewerImage {
  url: string
  alt: string
}

interface ProductImageViewerProps {
  images: ProductViewerImage[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

export default function ProductImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: ProductImageViewerProps) {
  const reduceMotion = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  const prev = useCallback(() => {
    if (images.length === 0) return
    onIndexChange((index - 1 + images.length) % images.length)
  }, [index, images.length, onIndexChange])

  const next = useCallback(() => {
    if (images.length === 0) return
    onIndexChange((index + 1) % images.length)
  }, [index, images.length, onIndexChange])

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, prev, next])

  const current = images[index] ?? images[0]
  if (!current) return null

  const duration = reduceMotion ? 0 : 0.2
  const controlClass =
    'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/25 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all duration-200 cursor-pointer motion-reduce:transition-none'

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imágenes del producto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-3 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Cerrar visor"
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/25 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all duration-200 cursor-pointer motion-reduce:transition-none"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>

      <motion.img
        key={current.url}
        src={current.url}
        alt={current.alt}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration }}
        draggable={false}
        className="max-w-full max-h-[calc(100dvh-7rem)] w-auto h-auto object-contain select-none"
      />

      {images.length > 1 && (
        <>
          <button type="button" onClick={prev} aria-label="Imagen anterior" className={`${controlClass} left-2 sm:left-4`}>
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={next} aria-label="Imagen siguiente" className={`${controlClass} right-2 sm:right-4`}>
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
          <p
            aria-live="polite"
            className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-white/75 text-xs font-medium tracking-wide"
          >
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </motion.div>
  )
}
