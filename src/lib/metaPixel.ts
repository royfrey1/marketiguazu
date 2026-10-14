// ============================================================
// lib/metaPixel — utilidad central del Meta Pixel (Facebook)
// ============================================================
// El código base del Pixel (fbq init + PageView inicial + noscript)
// vive UNA sola vez en index.html, con el ID tomado de la variable
// de entorno VITE_META_PIXEL_ID. Este módulo solo dispara eventos:
// no repite el ID en ningún lado.
//
// Reglas:
// - Nunca explota si window.fbq no existe (adblockers, carga lenta):
//   el snippet oficial deja un stub que encola, pero si el script
//   fue bloqueado simplemente no hace nada.
// - No corre en entorno de servidor (typeof window).
// - Nunca envía datos personales: solo ids/nombres de producto,
//   búsquedas, cantidades y montos.
// ============================================================

/** Moneda única de la tienda (pesos argentinos, sin símbolo). */
export const META_CURRENCY = 'ARS'

/**
 * El admin queda fuera del Pixel: no se emiten eventos en rutas /admin
 * (tampoco el PageView inicial, condicionado en index.html).
 */
export function shouldTrackPageView(pathname: string): boolean {
  return !pathname.startsWith('/admin')
}

/**
 * Purchase solo con pago de Mercado Pago aprobado: la página de éxito puede
 * mostrarse mientras el webhook todavía está en proceso (pendiente/en proceso),
 * y en ese caso NO se emite. Un pedido cancelado tampoco cuenta.
 */
export function isPurchaseApproved(
  paymentStatus: string | null | undefined,
  orderStatus: string | null | undefined,
): boolean {
  return paymentStatus === 'approved' && orderStatus !== 'cancelled'
}

type FbqParams = Record<string, string | number | boolean | undefined | (string | number)[]>

declare global {
  interface Window {
    fbq?: (command: 'track', event: string, params?: FbqParams) => void
  }
}

/**
 * Dispara un evento del Meta Pixel de forma segura.
 * No-op si no hay window (SSR) o si fbq no está disponible.
 */
export function trackMetaEvent(event: string, params?: FbqParams): void {
  if (typeof window === 'undefined') return
  const fbq = window.fbq
  if (typeof fbq !== 'function') return
  try {
    fbq('track', event, params)
  } catch {
    // Un error de tracking jamás debe romper la tienda
  }
}

// ------------------------------------------------------------
// Purchase: una sola vez por pedido (por pestaña)
// ------------------------------------------------------------
// sessionStorage evita el doble disparo al recargar la página de
// confirmación. Si sessionStorage no está disponible, el guard en
// memoria sigue evitando duplicados dentro de la sesión de la SPA.
const PURCHASE_KEY_PREFIX = 'meta_pixel_purchase_'
const purchasedInMemory = new Set<number>()

export function trackPurchaseOnce(orderId: number, params: FbqParams): void {
  if (purchasedInMemory.has(orderId)) return
  const key = `${PURCHASE_KEY_PREFIX}${orderId}`
  try {
    if (sessionStorage.getItem(key)) {
      purchasedInMemory.add(orderId)
      return
    }
    sessionStorage.setItem(key, '1')
  } catch {
    // Sin sessionStorage: el Set en memoria cubre la sesión actual
  }
  purchasedInMemory.add(orderId)
  trackMetaEvent('Purchase', params)
}
