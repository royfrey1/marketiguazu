import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applyRouteArea } from '../../lib/routeArea'

/** Mantiene <html data-area> al navegar entre tienda y admin, antes de pintar (sin salto de tamaño) */
export default function RouteAreaSync() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    applyRouteArea(pathname)
  }, [pathname])

  return null
}
