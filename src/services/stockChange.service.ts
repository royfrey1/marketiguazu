import { supabase } from '../lib/supabase/client'
import { clearAvailabilityCache } from './products.service'
import { addBaseRowInfo, applyInventoryFilters, type AdminInventoryFilters } from './inventory.service'
import type { StockChangeItem, StockChangeMeta, StockRowData } from '../lib/stockChange'

// ── Contrato de las RPC (Etapa 3) ────────────────────────────────────────

export interface StockChangeApplyResult {
  /** null = todo quedó igual (no se creó lote) */
  batch_id: string | null
  changed: number
  unchanged: number
}

export type StockProblemReason = 'no_existe' | 'duplicado' | 'en_papelera' | 'stock_cambiado' | 'stock_invalido'

export interface StockProblem {
  inventory_id: number | null
  product_id: number | null
  variant_id: number | null
  motivo: StockProblemReason
}

export type StockUndoSkipReason = 'stock_negativo' | 'stock_insuficiente' | 'no_existe'

export interface StockChangeUndoResult {
  /** null = no se restauró nada (el lote original no queda deshecho) */
  batch_id: string | null
  restored: number
  skipped: { inventory_id: number; product_id: number | null; variant_id: number | null; motivo: StockUndoSkipReason }[]
}

export interface StockChangeBatch {
  id: string
  created_at: string
  /** {modo, valor, motivo}; en un deshacer, {modo: "undo"} */
  meta: { modo?: string; valor?: number; motivo?: string } | null
  rows_count: number | null
  undo_of: string | null
  undone_at: string | null
  /** Hasta 5 títulos de los productos tocados, sin repetir. Se normaliza a [] si falta */
  productos?: string[]
  /** Todos los productos distintos tocados. Se normaliza a 0 */
  productos_total?: number
}

/** Tolera respuestas sin los campos de productos (o con basura): quedan [] y 0 */
function normalizeBatch(batch: StockChangeBatch): StockChangeBatch {
  const productos = Array.isArray(batch.productos) ? batch.productos.filter((t): t is string => typeof t === 'string') : []
  const total = typeof batch.productos_total === 'number' && Number.isFinite(batch.productos_total) ? batch.productos_total : 0
  const meta = batch.meta && typeof batch.meta === 'object' && !Array.isArray(batch.meta) ? batch.meta : null
  return { ...batch, meta, productos, productos_total: Math.max(total, productos.length) }
}

export type StockChangeErrorKey =
  | 'FORBIDDEN'
  | 'BATCH_INVALID'
  | 'VALUE_INVALID'
  | 'NOT_FOUND'
  | 'IN_TRASH'
  | 'STOCK_CHANGED'
  | 'BELOW_RESERVED'
  | 'BATCH_NOT_FOUND'
  | 'ALREADY_UNDONE'
  | 'UNKNOWN'

const ERROR_KEYS: Record<string, Exclude<StockChangeErrorKey, 'UNKNOWN'>> = {
  P4003: 'FORBIDDEN',
  '42501': 'FORBIDDEN',
  P4094: 'BATCH_INVALID',
  '22023': 'VALUE_INVALID',
  P4095: 'NOT_FOUND',
  P4043: 'IN_TRASH',
  P4096: 'STOCK_CHANGED',
  P4097: 'BELOW_RESERVED',
  P4098: 'BATCH_NOT_FOUND',
  P4099: 'ALREADY_UNDONE',
}

const ERROR_MESSAGES: Record<Exclude<StockChangeErrorKey, 'UNKNOWN'>, string> = {
  FORBIDDEN: 'No tenés permisos de administrador para cambiar el stock. Si lo sos, volvé a iniciar sesión.',
  BATCH_INVALID: 'No se pudo enviar el cambio: está vacío o es demasiado grande. No se modificó ningún stock.',
  VALUE_INVALID: 'Algún dato del cambio no es válido (el stock va de 0 a 1.000.000, sin decimales). No se modificó ningún stock.',
  NOT_FOUND: 'Algunas filas ya no existen o están repetidas. No se modificó ningún stock.',
  IN_TRASH: 'Algunos productos están en la papelera. No se modificó ningún stock.',
  STOCK_CHANGED: 'El stock cambió mientras revisabas (por ejemplo, entró una venta). No se modificó ningún stock.',
  BELOW_RESERVED: 'Algunas filas quedarían por debajo de lo reservado. No se modificó ningún stock.',
  BATCH_NOT_FOUND: 'No se encontró ese cambio.',
  ALREADY_UNDONE: 'Este cambio ya fue deshecho.',
}

const MOTIVO_MESSAGE = 'El motivo tiene que tener entre 3 y 200 caracteres. No se modificó ningún stock.'

/**
 * Error de las RPC de stock: mensaje amable en `message`, y el texto del servidor (con el código y la
 * lista de problemas) en `detail`, para el detalle técnico plegable de FriendlyError.
 */
export class StockChangeError extends Error {
  key: StockChangeErrorKey
  code: string | null
  detail: string
  problems: StockProblem[]

  constructor(key: StockChangeErrorKey, message: string, code: string | null, detail: string, problems: StockProblem[]) {
    super(message)
    this.name = 'StockChangeError'
    this.key = key
    this.code = code
    this.detail = detail
    this.problems = problems
  }
}

/** error.details es un string JSON con {"problems": [...]} (o nada): se parsea sin romper */
function parseProblems(details: unknown): StockProblem[] {
  if (typeof details !== 'string' || details.trim() === '') return []
  try {
    const parsed = JSON.parse(details) as { problems?: unknown }
    return Array.isArray(parsed?.problems) ? (parsed.problems as StockProblem[]) : []
  } catch {
    return []
  }
}

export function toStockChangeError(error: unknown): StockChangeError {
  if (error instanceof StockChangeError) return error
  const { code = null, message = '', details = null } = (error ?? {}) as { code?: string | null; message?: string; details?: unknown }
  const key = code ? ERROR_KEYS[code] : undefined
  const problems = parseProblems(details)
  const detail = [message || 'Sin respuesta del servidor', code ? `(código ${code})` : '', typeof details === 'string' && details ? details : '']
    .filter(Boolean)
    .join(' ')
  if (key) {
    const friendly = key === 'VALUE_INVALID' && /MOTIVO/i.test(message) ? MOTIVO_MESSAGE : ERROR_MESSAGES[key]
    return new StockChangeError(key, friendly, code, detail, problems)
  }
  return new StockChangeError('UNKNOWN', message || 'Error de red o inesperado', code, detail, problems)
}

// Las RPC de la Etapa 3 todavía no están en los tipos generados de la base: se llaman sin tipar
type UntypedRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
const rpc: UntypedRpc = (fn, args) => (supabase.rpc as unknown as UntypedRpc).call(supabase, fn, args)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const view = () => (supabase as any).from('inventory_admin_view')

/** Lecturas de a 100 ids (la URL de .in() no crece sin límite) */
const ID_CHUNK = 100
/** Filas por consulta (límite de PostgREST) */
const PAGE = 1000

const toNumber = (v: unknown) => (typeof v === 'number' ? v : Number(v))

export const stockChangeService = {
  /**
   * "Seleccionar las N filas": ids de todas las filas que cumplen los filtros actuales (solo lectura,
   * de a 1.000)
   */
  async getInventoryIds(filters: AdminInventoryFilters): Promise<{ data: number[]; error: Error | null }> {
    const ids: number[] = []
    // Se sigue hasta juntar el total contado: si el servidor devuelve menos filas por consulta que PAGE,
    // no se corta antes de tiempo
    for (let total = Infinity; ids.length < total; ) {
      const { data, error, count } = await applyInventoryFilters(view().select('id', { count: 'exact' }), filters)
        .order('id', { ascending: true })
        .range(ids.length, ids.length + PAGE - 1)
      if (error) return { data: [], error: new Error(error.message) }
      const rows = (data ?? []) as { id: number }[]
      for (const r of rows) ids.push(toNumber(r.id))
      if (rows.length === 0) break
      total = typeof count === 'number' ? count : rows.length < PAGE ? ids.length : Infinity
    }
    return { data: ids, error: null }
  },

  /**
   * Lectura fresca (solo lectura) de las filas elegidas. La vista omite las filas de productos en la
   * papelera: un id que no vuelve está "no disponible".
   */
  async getStockChangeRows(ids: number[]): Promise<{ data: StockRowData[]; error: Error | null }> {
    const rows: StockRowData[] = []
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const { data, error } = await view()
        .select('id, product_id, variant_id, quantity, reserved, product_titulo, variant_nombre, variant_activo')
        .in('id', ids.slice(i, i + ID_CHUNK))
      if (error) return { data: [], error: new Error(error.message) }
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        rows.push({
          id: toNumber(r.id),
          product_id: toNumber(r.product_id),
          variant_id: r.variant_id === null || r.variant_id === undefined ? null : toNumber(r.variant_id),
          product_titulo: String(r.product_titulo ?? ''),
          variant_nombre: typeof r.variant_nombre === 'string' ? r.variant_nombre : null,
          variant_activo: typeof r.variant_activo === 'boolean' ? r.variant_activo : null,
          quantity: toNumber(r.quantity),
          reserved: toNumber(r.reserved),
        })
      }
    }
    // "Fila base (opción base)": de a 100 productos, como la lectura
    for (let i = 0; i < rows.length; i += ID_CHUNK) await addBaseRowInfo(rows.slice(i, i + ID_CHUNK))
    return { data: rows, error: null }
  },

  /** Un solo lote, todo o nada (máximo 500 filas: no se parte en varias llamadas) */
  async applyStockChangeBulk(
    items: StockChangeItem[],
    meta: StockChangeMeta
  ): Promise<{ data: StockChangeApplyResult | null; error: StockChangeError | null }> {
    const { data, error } = await rpc('apply_stock_change_bulk', { p_items: items, p_meta: meta })
    if (error) return { data: null, error: toStockChangeError(error) }
    const result = data as StockChangeApplyResult
    if (result?.batch_id) clearAvailabilityCache()
    return { data: result, error: null }
  },

  async undoStockChangeBulk(batchId: string): Promise<{ data: StockChangeUndoResult | null; error: StockChangeError | null }> {
    const { data, error } = await rpc('undo_stock_change_bulk', { p_batch_id: batchId })
    if (error) return { data: null, error: toStockChangeError(error) }
    const result = data as StockChangeUndoResult
    if (result?.batch_id) clearAvailabilityCache()
    return { data: { ...result, skipped: Array.isArray(result?.skipped) ? result.skipped : [] }, error: null }
  },

  async listRecentStockBatches(limit = 10): Promise<{ data: StockChangeBatch[]; error: StockChangeError | null }> {
    const { data, error } = await rpc('list_recent_stock_batches', { p_limit: limit })
    if (error) return { data: [], error: toStockChangeError(error) }
    const list = Array.isArray(data) ? (data as StockChangeBatch[]) : []
    return { data: list.map(normalizeBatch), error: null }
  },
}
