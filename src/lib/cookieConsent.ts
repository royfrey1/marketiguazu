// ============================================================
// lib/cookieConsent — consentimiento de cookies (opt-in)
// ============================================================
// Una sola categoría opcional: medición y publicidad (Meta Pixel).
// Sin decisión vigente, sin almacenamiento disponible o con la decisión
// vencida (12 meses) se trata como "sin decisión": no se carga el Pixel.
// ============================================================

export type ConsentValue = 'granted' | 'denied'

export const COOKIE_CONSENT_KEY = 'iguazu_cookie_consent'
/** La decisión vence a los 12 meses: después se vuelve a preguntar */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

const CHANGE_EVENT = 'iguazu:cookie-consent-change'
const OPEN_PREFERENCES_EVENT = 'iguazu:cookie-preferences-open'

interface StoredConsent {
  v: 1
  analytics: ConsentValue
  ts: number
}

// Si el almacenamiento falla al guardar, la decisión vale solo para ocultar el banner en esta sesión
// (el Pixel no se carga: getConsent sigue devolviendo null)
let decidedInMemory = false

function readStored(): StoredConsent | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(COOKIE_CONSENT_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent> | null
    if (!parsed || parsed.v !== 1) return null
    if (parsed.analytics !== 'granted' && parsed.analytics !== 'denied') return null
    if (typeof parsed.ts !== 'number' || !Number.isFinite(parsed.ts)) return null
    if (Date.now() - parsed.ts > CONSENT_MAX_AGE_MS) return null
    return parsed as StoredConsent
  } catch {
    return null
  }
}

/** Decisión vigente sobre medición y publicidad, o null si no hay (o no se puede leer) */
export function getConsent(): ConsentValue | null {
  return readStored()?.analytics ?? null
}

/** Hay una decisión vigente (guardada, o tomada en esta sesión sin almacenamiento) */
export function hasDecided(): boolean {
  return decidedInMemory || readStored() !== null
}

/** Guarda la decisión y avisa a los suscriptores. Devuelve la decisión anterior. */
export function setConsent(value: ConsentValue): ConsentValue | null {
  const previous = getConsent()
  const stored: StoredConsent = { v: 1, analytics: value, ts: Date.now() }
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(stored))
  } catch {
    // Sin almacenamiento: no se recuerda entre visitas y el Pixel no se carga
  }
  decidedInMemory = true
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return previous
}

/** Suscripción a cambios (esta pestaña y otras pestañas del mismo sitio) */
export function subscribeConsent(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === COOKIE_CONSENT_KEY) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Abre el panel de preferencias (footer, página de privacidad) */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))
}

export function subscribeOpenPreferences(listener: () => void): () => void {
  window.addEventListener(OPEN_PREFERENCES_EVENT, listener)
  return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, listener)
}
