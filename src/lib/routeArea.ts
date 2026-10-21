// Área de la ruta en <html data-area>: el CSS escala la tienda al 90% desde tablet y deja el admin al 100% (index.css)
export type RouteArea = 'admin' | 'store'

/** /admin y sus subrutas son el panel; el resto es la tienda. Sin distinguir mayúsculas, igual que React Router */
export function getAreaForPath(pathname: string): RouteArea {
  const path = pathname.toLowerCase()
  return path === '/admin' || path.startsWith('/admin/') ? 'admin' : 'store'
}

export function applyRouteArea(pathname: string): void {
  document.documentElement.dataset.area = getAreaForPath(pathname)
}
