import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackMetaEvent, shouldTrackPageView, loadMetaPixel } from '../../lib/metaPixel'
import useCookieConsent from '../../hooks/useCookieConsent'

/**
 * Meta Pixel (solo con consentimiento): carga el Pixel y dispara PageView de la ruta actual
 * al arrancar con consentimiento ya dado o al aceptarlo, y en cada cambio de ruta de la SPA.
 * Excluye /admin. Cada ruta cuenta una sola vez (StrictMode, revocar y volver a aceptar en la
 * misma página no duplican el PageView).
 */
export default function MetaPixelPageView() {
  const location = useLocation()
  const { consent } = useCookieConsent()
  const lastTrackedRef = useRef<string | null>(null)

  useEffect(() => {
    if (consent !== 'granted') {
      // Si navega sin consentimiento, la página en la que acepte después cuenta como vista nueva
      if (lastTrackedRef.current !== location.pathname) lastTrackedRef.current = null
      return
    }
    if (lastTrackedRef.current === location.pathname) return
    // /admin: ni PageView ni carga del Pixel (al salir a la tienda, la nueva ruta sí cuenta)
    if (!shouldTrackPageView(location.pathname)) {
      lastTrackedRef.current = location.pathname
      return
    }
    if (!loadMetaPixel()) return
    lastTrackedRef.current = location.pathname
    trackMetaEvent('PageView')
  }, [consent, location.pathname])

  return null
}
