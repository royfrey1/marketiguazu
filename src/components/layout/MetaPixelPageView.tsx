import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackMetaEvent, shouldTrackPageView } from '../../lib/metaPixel'

/**
 * Meta Pixel: PageView en cada cambio de ruta de la SPA, excluyendo /admin
 * (el admin queda fuera del Pixel; si la ruta de llegada es /admin no se emite
 * y el guard se actualiza igual para que el siguiente cambio de ruta sí cuente).
 * El PageView de la carga inicial lo dispara el snippet base de index.html
 * (que también salta /admin); este componente no lo duplica.
 */
export default function MetaPixelPageView() {
  const location = useLocation()
  const lastPathRef = useRef(location.pathname)

  useEffect(() => {
    const changed = lastPathRef.current !== location.pathname
    lastPathRef.current = location.pathname
    if (!changed) return
    if (!shouldTrackPageView(location.pathname)) return
    trackMetaEvent('PageView')
  }, [location.pathname])

  return null
}
