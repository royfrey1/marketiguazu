import { useSyncExternalStore } from 'react'
import { getConsent, hasDecided, subscribeConsent, type ConsentValue } from '../lib/cookieConsent'

/** Decisión de cookies vigente; se actualiza al cambiarla (también desde otra pestaña) */
export default function useCookieConsent(): { consent: ConsentValue | null; decided: boolean } {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null)
  const decided = useSyncExternalStore(subscribeConsent, hasDecided, () => false)
  return { consent, decided }
}
