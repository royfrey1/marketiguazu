// ============================================================
// lib/metaPixel — utilidad central del Meta Pixel (Facebook)
// ============================================================
// OPT-IN: el Pixel no se carga ni contacta a Meta hasta que el visitante
// acepta las cookies de medición y publicidad (lib/cookieConsent).
// loadMetaPixel inyecta el código base oficial una sola vez, con el ID
// tomado de la variable de entorno VITE_META_PIXEL_ID (nunca escrito en
// el código). Sin consentimiento los eventos se descartan (no se encolan).
//
// Reglas:
// - Nunca explota si window.fbq no existe (adblockers, carga lenta):
//   el snippet oficial deja un stub que encola, pero si el script
//   fue bloqueado simplemente no hace nada.
// - No corre en entorno de servidor (typeof window).
// - Nunca envía datos personales: solo ids/nombres de producto,
//   búsquedas, cantidades y montos.
// ============================================================

import { getConsent, setConsent, type ConsentValue } from './cookieConsent'

/** Moneda única de la tienda (pesos argentinos, sin símbolo). */
export const META_CURRENCY = 'ARS'

/** Cookies propias que crea el Pixel (se borran al revocar el consentimiento) */
const META_COOKIES = ['_fbp', '_fbc']
const FBEVENTS_SRC = 'https://connect.facebook.net/en_US/fbevents.js'

/**
 * El admin queda fuera del Pixel: no se emiten eventos en rutas /admin
 * (tampoco el PageView de la ruta de llegada).
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

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[][]
  push?: Fbq
  loaded?: boolean
  version?: string
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let pixelLoaded = false

/** ID del Pixel desde el entorno; null si falta o no es numérico (mismo guard de siempre) */
function pixelId(): string | null {
  const id = String(import.meta.env.VITE_META_PIXEL_ID ?? '')
  return /^\d+$/.test(id) ? id : null
}

/**
 * Carga el Pixel (código base oficial) solo con consentimiento 'granted' y un ID numérico.
 * Idempotente: una sola carga por página. Devuelve true si el Pixel quedó cargado.
 */
export function loadMetaPixel(): boolean {
  if (typeof window === 'undefined') return false
  if (getConsent() !== 'granted') return false
  if (pixelLoaded) return true
  const pxid = pixelId()
  if (!pxid) return false

  try {
    if (!window.fbq) {
      // Código base oficial del Pixel (equivalente al snippet de Meta, sin minificar)
      const fbq: Fbq = function (...args: unknown[]) {
        if (fbq.callMethod) fbq.callMethod(...args)
        else fbq.queue!.push(args)
      }
      if (!window._fbq) window._fbq = fbq
      fbq.push = fbq
      fbq.loaded = true
      fbq.version = '2.0'
      fbq.queue = []
      window.fbq = fbq
      const script = document.createElement('script')
      script.async = true
      script.src = FBEVENTS_SRC
      const first = document.getElementsByTagName('script')[0]
      if (first?.parentNode) first.parentNode.insertBefore(script, first)
      else document.head.appendChild(script)
    }
    // Sin autoConfig: Meta no debe registrar clics (SubscribedButtonClick) ni metadatos
    // de la página; solo los eventos de este módulo. El 'set' va antes del 'init' (doc de Meta)
    window.fbq('set', 'autoConfig', false, pxid)
    window.fbq('init', pxid)
    pixelLoaded = true
  } catch {
    return false
  }
  return true
}

/** Borra una cookie en el dominio actual y en los dominios padre (best-effort) */
function deleteCookie(name: string) {
  const expire = `${name}=; Max-Age=0; path=/`
  document.cookie = expire
  const parts = window.location.hostname.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    document.cookie = `${expire}; domain=.${parts.slice(i).join('.')}`
  }
}

/**
 * Guarda la decisión del visitante. Al aceptar carga el Pixel (el PageView lo dispara
 * MetaPixelPageView al ver el cambio); al revocar avisa a Meta, deja de enviar eventos y
 * borra _fbp/_fbc. El script ya descargado sigue en memoria hasta recargar la página.
 */
export function updateCookieConsent(value: ConsentValue): void {
  const previous = setConsent(value)
  if (value === 'granted') {
    if (pixelLoaded) {
      try { window.fbq?.('consent', 'grant') } catch { /* noop */ }
    }
    loadMetaPixel()
    return
  }
  if (previous === 'granted' || pixelLoaded) {
    try { window.fbq?.('consent', 'revoke') } catch { /* noop */ }
  }
  try {
    for (const name of META_COOKIES) deleteCookie(name)
  } catch {
    // Best-effort: sin acceso a cookies no se puede borrar nada
  }
}

/**
 * Dispara un evento del Meta Pixel de forma segura.
 * No-op sin consentimiento 'granted' (el evento se descarta), si no hay window (SSR)
 * o si el Pixel no se pudo cargar.
 */
export function trackMetaEvent(event: string, params?: FbqParams): void {
  if (typeof window === 'undefined') return
  if (!loadMetaPixel()) return
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
  // Sin consentimiento no se marca ni se envía (el evento se descarta)
  if (!loadMetaPixel()) return
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
