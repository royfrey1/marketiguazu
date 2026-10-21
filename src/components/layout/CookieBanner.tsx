import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import useCookieConsent from '../../hooks/useCookieConsent'
import { subscribeOpenPreferences, type ConsentValue } from '../../lib/cookieConsent'
import { updateCookieConsent } from '../../lib/metaPixel'

// Mismo estilo para Aceptar y Rechazar: igual jerarquía visual (rechazar no queda escondido)
const CHOICE_BUTTON =
  'flex-1 inline-flex items-center justify-center min-h-11 px-5 text-sm font-bold rounded-xl ' +
  'bg-primary-dark text-white hover:bg-primary transition-colors cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const SECONDARY_BUTTON =
  'flex-1 inline-flex items-center justify-center min-h-11 px-5 text-sm font-bold rounded-xl ' +
  'border border-gray-300 text-primary-dark hover:bg-gray-50 transition-colors cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const LINK_CLASS = 'font-semibold text-accent hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/**
 * Consentimiento de cookies (opt-in) en la tienda.
 * - Banner inferior (no modal) mientras no haya una decisión vigente: Aceptar / Rechazar.
 * - Panel de preferencias, el mismo componente, que se abre desde "Preferencias de cookies".
 * No aparece en /admin. Mientras se ve, un espacio al final de la página evita que tape contenido.
 */
export default function CookieBanner() {
  const { pathname } = useLocation()
  const { consent, decided } = useCookieConsent()
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [analyticsOn, setAnalyticsOn] = useState(false)
  const [height, setHeight] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const prefsHeadingRef = useRef<HTMLHeadingElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  const isAdmin = pathname.startsWith('/admin')
  const visible = !isAdmin && (prefsOpen || !decided)

  const consentRef = useRef(consent)
  useEffect(() => {
    consentRef.current = consent
  }, [consent])

  // Apertura desde el footer o la página de privacidad: el interruptor refleja la decisión actual
  useEffect(() => subscribeOpenPreferences(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setAnalyticsOn(consentRef.current === 'granted')
    setPrefsOpen(true)
  }), [])

  // Foco al título del panel al abrirlo (lo abrió el visitante; el banner inicial no roba el foco)
  useEffect(() => {
    if (prefsOpen) prefsHeadingRef.current?.focus()
  }, [prefsOpen])

  // Alto del panel para el espacio al final de la página
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!visible || !panel) return
    const update = () => setHeight(panel.offsetHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [visible, prefsOpen])

  if (!visible) return null

  const closePrefs = () => {
    setPrefsOpen(false)
    const opener = openerRef.current
    openerRef.current = null
    if (opener?.isConnected) requestAnimationFrame(() => opener.focus())
  }

  const decide = (value: ConsentValue) => {
    updateCookieConsent(value)
    if (prefsOpen) closePrefs()
  }

  return (
    <>
      {/* Espacio en el flujo: el final de la página (footer, botones) queda visible por encima del panel */}
      <div aria-hidden="true" style={{ height }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={e => {
          if (e.key === 'Escape' && prefsOpen) closePrefs()
        }}
        className="fixed z-[45] left-2 right-2 sm:left-4 sm:right-auto sm:max-w-md bg-white text-gray-700 border border-gray-200 rounded-2xl shadow-2xl p-4 sm:p-5"
        style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {prefsOpen ? (
          <div className="space-y-4">
            <h2
              ref={prefsHeadingRef}
              id={titleId}
              tabIndex={-1}
              className="flex items-center gap-2 text-base font-bold text-primary-dark rounded focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Cookie className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
              Preferencias de cookies
            </h2>
            <div id={descId} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary-dark">Necesarias</p>
                  <p className="text-xs text-gray-500 mt-0.5">Sesión, carrito y esta preferencia. Siempre activas.</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-gray-500 min-h-11 inline-flex items-center">Siempre activas</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p id={`${titleId}-meta`} className="text-sm font-semibold text-primary-dark">Medición y publicidad (Meta Pixel)</p>
                  <p className="text-xs text-gray-500 mt-0.5">Nos ayudan a medir y mejorar nuestros anuncios.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsOn}
                  aria-labelledby={`${titleId}-meta`}
                  onClick={() => setAnalyticsOn(on => !on)}
                  className="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className={`relative inline-block w-11 h-6 rounded-full transition-colors ${analyticsOn ? 'bg-primary' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${analyticsOn ? 'translate-x-5' : ''}`} />
                  </span>
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Podés cambiar tu decisión cuando quieras. Algunos cambios se aplican por completo al recargar la página.{' '}
                <Link to="/privacidad" className={LINK_CLASS}>Política de privacidad</Link>
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" onClick={closePrefs} className={SECONDARY_BUTTON}>
                Cancelar
              </button>
              <button type="button" onClick={() => decide(analyticsOn ? 'granted' : 'denied')} className={CHOICE_BUTTON}>
                Guardar preferencias
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 id={titleId} className="flex items-center gap-2 text-sm font-bold text-primary-dark">
              <Cookie className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
              Cookies
            </h2>
            <p id={descId} className="text-sm text-gray-600 leading-snug">
              Usamos cookies necesarias para que el sitio funcione y, si lo aceptás, cookies de medición y publicidad (Meta)
              para mejorar nuestros anuncios.{' '}
              <Link to="/privacidad" className={LINK_CLASS}>Más información</Link>
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => decide('denied')} className={CHOICE_BUTTON}>
                Rechazar
              </button>
              <button type="button" onClick={() => decide('granted')} className={CHOICE_BUTTON}>
                Aceptar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
