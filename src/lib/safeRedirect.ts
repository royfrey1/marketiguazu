// Retorno tras login/registro (?redirect=): solo rutas internas, para no abrir un open redirect.

const BASE = 'https://interno.invalid'

/**
 * Devuelve la ruta interna (pathname + search + hash) si `value` es segura, o null.
 * Rechaza URLs absolutas, protocolo relativo (//host), barras invertidas y las páginas de auth.
 */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return null
    if (['/login', '/register', '/reset-password'].includes(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** `/login?redirect=...` (o `/register`) con el retorno codificado, si es seguro */
export function withRedirect(path: '/login' | '/register', redirect: string | null | undefined): string {
  const safe = safeInternalPath(redirect)
  return safe ? `${path}?redirect=${encodeURIComponent(safe)}` : path
}
