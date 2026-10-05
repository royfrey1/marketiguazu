import { useCallback, useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { whatsappUrl } from '../../lib/whatsapp'

const SCROLL_SHOW_THRESHOLD = 400

const surfaceClasses =
  'flex items-center justify-center w-11 h-11 rounded-full ' +
  'bg-white border border-gray-200 shadow-md ' +
  'transition-[transform,box-shadow,opacity,translate] duration-200 ease-out ' +
  'hover:-translate-y-0.5 hover:shadow-lg ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-md'

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

export default function StorefrontFloatingActions() {
  const [showBackToTop, setShowBackToTop] = useState(
    () => window.scrollY > SCROLL_SHOW_THRESHOLD
  )

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > SCROLL_SHOW_THRESHOLD)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleBackToTop = useCallback(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }, [])

  return (
    <div
      className="fixed z-40 flex flex-col gap-2 items-end"
      style={{
        right: 'max(1rem, env(safe-area-inset-right, 0px) + 1rem)',
        bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp"
          className={`${surfaceClasses} text-[#25D366] hover:border-secondary/40 hover:ring-2 hover:ring-secondary/20`}
        >
          <WhatsAppIcon />
        </a>
      )}

      <button
        type="button"
        onClick={handleBackToTop}
        aria-label="Volver arriba"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
        className={`${surfaceClasses} text-primary-dark hover:text-accent ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  )
}
