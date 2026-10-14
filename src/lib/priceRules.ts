// Regla de precio del admin (la misma que valida la base: CHECK precio > 0 + las RPC con 22023)

export const PRICE_POSITIVE_MESSAGE = 'El precio debe ser mayor a 0'

/** Número del campo, o null si está vacío o no es numérico */
export function parsePriceInput(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/** Error del campo precio (vacío, 0, negativo o no numérico), o null si es válido */
export function priceFieldError(value: unknown): string | null {
  const n = parsePriceInput(value)
  return n === null || n <= 0 ? PRICE_POSITIVE_MESSAGE : null
}

const PRICE_CHECK_CONSTRAINT = /\b(?:products|product_variants)_precio_check\b/

/**
 * El error de la base es por el precio: la RPC (22023 con el mensaje de precio) o el CHECK de la tabla
 * (23514 sobre products_precio_check / product_variants_precio_check). Los demás 22023 (ofertas) no.
 */
export function isPriceDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const { code, message, details } = err as { code?: unknown; message?: unknown; details?: unknown }
  if (code === '22023') return message === PRICE_POSITIVE_MESSAGE
  if (code === '23514') return PRICE_CHECK_CONSTRAINT.test(`${message ?? ''} ${details ?? ''}`)
  return false
}
