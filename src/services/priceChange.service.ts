import { supabase } from '../lib/supabase/client'
import type {
  PriceChangeItem,
  PriceChangeMeta,
  PriceProductData,
  PriceVariantData,
} from '../lib/priceChange'

// ── Contrato de las RPC (Etapa 2B) ───────────────────────────────────────

export interface PriceChangeApplyResult {
  /** null = todo quedó igual (no se creó lote) */
  batch_id: string | null
  products_changed: number
  variants_changed: number
  unchanged: number
}

export type PriceProblemReason = 'no_existe' | 'duplicado' | 'en_papelera' | 'precio_cambiado' | 'oferta_invalida'

export interface PriceProblem {
  product_id: number | null
  variant_id: number | null
  motivo: PriceProblemReason
}

export interface PriceChangeUndoResult {
  /** null = no se restauró nada (el lote original no queda deshecho) */
  batch_id: string | null
  restored_products: number
  restored_variants: number
  skipped: { product_id: number | null; variant_id: number | null; motivo: 'precio_cambiado' | 'no_existe' }[]
}

export interface PriceChangeBatch {
  id: string
  created_at: string
  meta: Partial<PriceChangeMeta> & { undo_of?: string }
  products_count: number | null
  variants_count: number | null
  undo_of: string | null
  undone_at: string | null
  /** Hasta 5 títulos de los productos tocados (base y variantes), sin repetir. Se normaliza a [] si falta */
  productos?: string[]
  /** Todos los productos distintos tocados, incluidos los que no entran en `productos`. Se normaliza a 0 */
  productos_total?: number
}

/** Tolera respuestas sin los campos de productos (o con basura): quedan [] y 0 */
function normalizeBatch(batch: PriceChangeBatch): PriceChangeBatch {
  const productos = Array.isArray(batch.productos) ? batch.productos.filter((t): t is string => typeof t === 'string') : []
  const total = typeof batch.productos_total === 'number' && Number.isFinite(batch.productos_total) ? batch.productos_total : 0
  return { ...batch, productos, productos_total: Math.max(total, productos.length) }
}

export type PriceChangeErrorKey =
  | 'FORBIDDEN'
  | 'BATCH_INVALID'
  | 'PRICE_INVALID'
  | 'NOT_FOUND'
  | 'IN_TRASH'
  | 'PRICE_CHANGED'
  | 'OFFER_INVALID'
  | 'BATCH_NOT_FOUND'
  | 'ALREADY_UNDONE'
  | 'UNKNOWN'

const ERROR_KEYS: Record<string, Exclude<PriceChangeErrorKey, 'UNKNOWN'>> = {
  P4003: 'FORBIDDEN',
  P4094: 'BATCH_INVALID',
  '22023': 'PRICE_INVALID',
  P4095: 'NOT_FOUND',
  P4043: 'IN_TRASH',
  P4096: 'PRICE_CHANGED',
  P4097: 'OFFER_INVALID',
  P4098: 'BATCH_NOT_FOUND',
  P4099: 'ALREADY_UNDONE',
}

const ERROR_MESSAGES: Record<Exclude<PriceChangeErrorKey, 'UNKNOWN'>, string> = {
  FORBIDDEN: 'No tenés permisos de administrador para cambiar precios.',
  BATCH_INVALID: 'No se pudo enviar el cambio: está vacío o es demasiado grande. No se modificó ningún precio.',
  PRICE_INVALID: 'Algún precio calculado no es válido (tiene que ser mayor a $0 y de hasta $9.999.999.999). No se modificó ningún precio.',
  NOT_FOUND: 'Algunos productos o variantes ya no existen. No se modificó ningún precio.',
  IN_TRASH: 'Algunos productos están en la papelera. No se modificó ningún precio.',
  PRICE_CHANGED: 'Los precios cambiaron mientras revisabas. No se modificó ningún precio.',
  OFFER_INVALID: 'Con el precio nuevo, algunas ofertas quedarían inválidas. No se modificó ningún precio.',
  BATCH_NOT_FOUND: 'No se encontró ese cambio.',
  ALREADY_UNDONE: 'Este cambio ya fue deshecho.',
}

/**
 * Error de las RPC de precios: mensaje amable en `message`, y el texto del servidor (con el código y la
 * lista de problemas) en `detail`, para el detalle técnico plegable de FriendlyError.
 */
export class PriceChangeError extends Error {
  key: PriceChangeErrorKey
  code: string | null
  detail: string
  problems: PriceProblem[]

  constructor(key: PriceChangeErrorKey, message: string, code: string | null, detail: string, problems: PriceProblem[]) {
    super(message)
    this.name = 'PriceChangeError'
    this.key = key
    this.code = code
    this.detail = detail
    this.problems = problems
  }
}

/** error.details es un string JSON con {"problems": [...]} (o nada): se parsea sin romper */
function parseProblems(details: unknown): PriceProblem[] {
  if (typeof details !== 'string' || details.trim() === '') return []
  try {
    const parsed = JSON.parse(details) as { problems?: unknown }
    return Array.isArray(parsed?.problems) ? (parsed.problems as PriceProblem[]) : []
  } catch {
    return []
  }
}

export function toPriceChangeError(error: unknown): PriceChangeError {
  if (error instanceof PriceChangeError) return error
  const { code = null, message = '', details = null } = (error ?? {}) as { code?: string | null; message?: string; details?: unknown }
  const key = code ? ERROR_KEYS[code] : undefined
  const problems = parseProblems(details)
  const detail = [message || 'Sin respuesta del servidor', code ? `(código ${code})` : '', typeof details === 'string' && details ? details : '']
    .filter(Boolean)
    .join(' ')
  if (key) return new PriceChangeError(key, ERROR_MESSAGES[key], code, detail, problems)
  return new PriceChangeError('UNKNOWN', message || 'Error de red o inesperado', code, detail, problems)
}

// Las RPC de la 2B todavía no están en los tipos generados de la base: se llaman sin tipar
type UntypedRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
const rpc: UntypedRpc = (fn, args) => (supabase.rpc as unknown as UntypedRpc).call(supabase, fn, args)

/** Lecturas de a 100 ids (la URL de .in() no crece sin límite) */
const ID_CHUNK = 100
/** Filas por consulta (límite de PostgREST) */
const PAGE = 1000

const toNumber = (v: unknown) => (typeof v === 'number' ? v : Number(v))
const toNullableNumber = (v: unknown) => (v === null || v === undefined ? null : toNumber(v))

export const priceChangeService = {
  /**
   * Lectura fresca (solo lectura) de los productos elegidos y de TODAS sus variantes, activas e inactivas.
   * Los ids que no vuelven ya no existen.
   */
  async getPriceChangeItems(ids: number[]): Promise<{ data: PriceProductData[]; error: Error | null }> {
    const products: PriceProductData[] = []
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const chunk = ids.slice(i, i + ID_CHUNK)
      const { data: rows, error } = await supabase
        .from('products')
        .select('id, titulo, activo, deleted_at, precio, precio_anterior, en_oferta')
        .in('id', chunk)
      if (error) return { data: [], error: new Error(error.message) }

      const variants: PriceVariantData[] = []
      for (let from = 0; ; from += PAGE) {
        const { data: vrows, error: vError } = await supabase
          .from('product_variants')
          .select('id, product_id, nombre, precio, precio_anterior, en_oferta, activo')
          .in('product_id', chunk)
          .order('product_id', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (vError) return { data: [], error: new Error(vError.message) }
        for (const v of vrows ?? []) {
          variants.push({
            id: v.id,
            product_id: v.product_id,
            nombre: v.nombre,
            precio: toNumber(v.precio),
            precio_anterior: toNullableNumber(v.precio_anterior),
            en_oferta: !!v.en_oferta,
            activo: !!v.activo,
          })
        }
        if (!vrows || vrows.length < PAGE) break
      }

      for (const r of rows ?? []) {
        products.push({
          id: r.id,
          titulo: r.titulo,
          activo: !!r.activo,
          deleted_at: r.deleted_at,
          precio: toNumber(r.precio),
          precio_anterior: toNullableNumber(r.precio_anterior),
          en_oferta: !!r.en_oferta,
          variantes: variants.filter(v => v.product_id === r.id),
        })
      }
    }
    return { data: products, error: null }
  },

  /** Un solo lote, todo o nada (máximo 500 filas: no se parte en varias llamadas) */
  async applyPriceChangeBulk(
    items: PriceChangeItem[],
    meta: PriceChangeMeta
  ): Promise<{ data: PriceChangeApplyResult | null; error: PriceChangeError | null }> {
    const { data, error } = await rpc('apply_price_change_bulk', { p_items: items, p_meta: meta })
    if (error) return { data: null, error: toPriceChangeError(error) }
    return { data: data as PriceChangeApplyResult, error: null }
  },

  async undoPriceChangeBulk(batchId: string): Promise<{ data: PriceChangeUndoResult | null; error: PriceChangeError | null }> {
    const { data, error } = await rpc('undo_price_change_bulk', { p_batch_id: batchId })
    if (error) return { data: null, error: toPriceChangeError(error) }
    const result = data as PriceChangeUndoResult
    return { data: { ...result, skipped: Array.isArray(result?.skipped) ? result.skipped : [] }, error: null }
  },

  async listRecentPriceBatches(limit = 10): Promise<{ data: PriceChangeBatch[]; error: PriceChangeError | null }> {
    const { data, error } = await rpc('list_recent_price_batches', { p_limit: limit })
    if (error) return { data: [], error: toPriceChangeError(error) }
    const list = Array.isArray(data) ? (data as PriceChangeBatch[]) : []
    return { data: list.map(normalizeBatch), error: null }
  },
}
