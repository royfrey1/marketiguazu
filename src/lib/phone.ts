// Teléfonos argentinos para contacto por WhatsApp.
// Se guardan normalizados como +549 + 10 dígitos (código de área + número, sin 0 ni 15).

const ALLOWED_CHARS = /^\+?[\d\s\-()]+$/
const LOCAL_DIGITS = 10
const AR_MOBILE_PREFIX = '+549'

/**
 * Normaliza un teléfono argentino a `+549XXXXXXXXXX`, o devuelve null si es inválido.
 * Acepta espacios, guiones, paréntesis y un `+` inicial; quita el prefijo 549 / 54 y
 * un 0 inicial. Lo que queda tiene que ser exactamente código de área + número (10 dígitos).
 *   "(3757) 12-3456", "03757 123456", "+54 9 3757 123456", "3757123456" → "+5493757123456"
 */
export function normalizeArPhone(input: string | null | undefined): string | null {
  const trimmed = (input ?? '').trim()
  if (!trimmed || !ALLOWED_CHARS.test(trimmed)) return null

  let digits = trimmed.replace(/\D/g, '')
  if (digits.startsWith('549')) digits = digits.slice(3)
  else if (digits.startsWith('54')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)

  return digits.length === LOCAL_DIGITS ? `${AR_MOBILE_PREFIX}${digits}` : null
}

/**
 * Valor para mostrar en el input al editar: los 10 dígitos sin +549 si el teléfono
 * guardado es válido; si no (datos viejos con otro formato), el valor tal cual.
 */
export function phoneToInputValue(stored: string | null | undefined): string {
  const normalized = normalizeArPhone(stored)
  return normalized ? normalized.slice(AR_MOBILE_PREFIX.length) : (stored ?? '')
}

/** Link `https://wa.me/<dígitos>` (con `?text=` opcional), o null si el teléfono es inválido. */
export function whatsappLinkFromPhone(phone: string, text?: string): string | null {
  const normalized = normalizeArPhone(phone)
  if (!normalized) return null
  const base = `https://wa.me/${normalized.slice(1)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export const PHONE_INVALID_MESSAGE =
  'Ingresá un teléfono válido con código de área, sin 0 ni 15 (ej: 3757 123456)'
export const PHONE_HELP_TEXT = 'Sin 0 ni 15. Lo usamos solo para coordinar tu pedido y tu pago.'
export const PHONE_PLACEHOLDER = '3757 123456'
