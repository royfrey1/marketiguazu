// Cambio masivo de stock (admin): cálculo puro de la vista previa y del lote que se manda a
// apply_stock_change_bulk. Cada fila de inventario (base o variante) es independiente.

export type StockChangeMode = 'set' | 'add' | 'sub'

export interface StockChangeConfig {
  modo: StockChangeMode
  valor: number
  /** Ya recortado (3..200 caracteres) */
  motivo: string
}

/** Tope de stock de la base */
export const MAX_STOCK = 1000000
/** Tope de filas por llamada: el lote es todo o nada, no se parte */
export const MAX_STOCK_ROWS = 500
export const MOTIVO_MIN = 3
export const MOTIVO_MAX = 200

/**
 * Entero escrito en formato es-AR o simple: "1500", "1.500" (miles), "1 500". Null si no es un entero
 * (decimales, negativos o texto).
 */
export function parseIntegerInput(text: string): number | null {
  let s = text.replace(/\s/g, '')
  if (s === '') return null
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

/** Error del valor (o null si es válido para el modo) */
export function valueError(modo: StockChangeMode, valorText: string): string | null {
  if (valorText.trim() === '') return modo === 'set' ? 'Ingresá el stock nuevo.' : 'Ingresá la cantidad de unidades.'
  const valor = parseIntegerInput(valorText)
  if (valor === null) {
    return /^\s*-/.test(valorText)
      ? 'No puede ser negativo: para descontar usá "Restar".'
      : 'Escribí un número entero, sin decimales (por ejemplo 10 o 1.500).'
  }
  if (modo !== 'set' && valor < 1) return 'Tiene que ser al menos 1 unidad.'
  if (valor > MAX_STOCK) return `El máximo es ${MAX_STOCK.toLocaleString('es-AR')}.`
  return null
}

/** Error del motivo (o null). Se valida recortado, como en la base */
export function motivoError(motivo: string): string | null {
  const length = motivo.trim().length
  if (length === 0) return 'Escribí el motivo del cambio.'
  if (length < MOTIVO_MIN) return `El motivo tiene que tener al menos ${MOTIVO_MIN} caracteres.`
  if (length > MOTIVO_MAX) return `El motivo puede tener hasta ${MOTIVO_MAX} caracteres.`
  return null
}

export function computeNewStock(actual: number, config: Pick<StockChangeConfig, 'modo' | 'valor'>): number {
  if (config.modo === 'set') return config.valor
  return config.modo === 'add' ? actual + config.valor : actual - config.valor
}

/** Fila leída de inventory_admin_view (fresca, al armar la vista previa) */
export interface StockRowData {
  id: number
  product_id: number
  variant_id: number | null
  product_titulo: string
  variant_nombre: string | null
  variant_activo: boolean | null
  quantity: number
  reserved: number
  /** Solo filas base: el producto tiene variantes activas */
  product_has_active_variants?: boolean
  product_opcion_base_nombre?: string | null
}

/** Lo que se sabe de una fila elegida aunque ya no vuelva en la lectura (para nombrarla) */
export interface StockSelectedItem {
  id: number
  titulo: string
  variante: string | null
}

export type StockExclusion = 'no_disponible' | 'no_alcanza' | 'supera_maximo' | 'bajo_reservado'
export type StockRowStatus = 'modificada' | 'sin_cambio' | 'excluida'

export interface StockPreviewRow {
  id: number
  titulo: string
  /** Nombre de la variante, "Fila base (…)" o null (producto sin variantes) */
  detalle: string | null
  varianteInactiva: boolean
  /** null si la fila ya no está disponible */
  actual: number | null
  reservado: number | null
  nuevo: number | null
  diferencia: number | null
  status: StockRowStatus
  exclusion: StockExclusion | null
  /** Se modifica y el disponible nuevo (nuevo - reservado) queda en 0 o menos */
  agotada: boolean
}

export interface StockChangeItem {
  inventory_id: number
  expected_quantity: number
  quantity: number
}

export interface StockChangeMeta {
  modo: StockChangeMode
  valor: number
  motivo: string
}

export interface StockPreview {
  rows: StockPreviewRow[]
  counts: { modificadas: number; sinCambio: number; excluidas: number; agotadas: number }
  /** Solo las filas incluidas con cambio real */
  items: StockChangeItem[]
  tooManyRows: boolean
}

/** "Fila base" en productos con variantes activas; "(opción base: X)" si la opción base tiene nombre */
export function stockRowDetail(row: Pick<StockRowData, 'variant_id' | 'variant_nombre' | 'product_has_active_variants' | 'product_opcion_base_nombre'>): string | null {
  if (row.variant_id !== null) return row.variant_nombre ?? 'Variante'
  if (!row.product_has_active_variants) return null
  const nombre = row.product_opcion_base_nombre?.trim()
  return nombre ? `Fila base (opción base: ${nombre})` : 'Fila base'
}

function exclusionOf(nuevo: number, reserved: number): StockExclusion | null {
  if (nuevo < 0) return 'no_alcanza'
  if (nuevo > MAX_STOCK) return 'supera_maximo'
  if (nuevo < reserved) return 'bajo_reservado'
  return null
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

/**
 * Vista previa y lote: una fila por cada id elegido. Las que no vuelven en la lectura (papelera o
 * eliminadas: la vista las omite) quedan excluidas como "no disponible". No se recorta a 0: una resta
 * que no alcanza excluye la fila.
 */
export function buildStockPreview(
  selected: StockSelectedItem[],
  data: StockRowData[],
  config: Pick<StockChangeConfig, 'modo' | 'valor'>
): StockPreview {
  const byId = new Map(data.map(r => [r.id, r]))
  const rows: StockPreviewRow[] = []
  const items: StockChangeItem[] = []
  const counts = { modificadas: 0, sinCambio: 0, excluidas: 0, agotadas: 0 }

  const fresh = selected.map(s => byId.get(s.id)).filter((r): r is StockRowData => !!r)
  fresh.sort((a, b) =>
    collator.compare(a.product_titulo, b.product_titulo)
    || a.product_id - b.product_id
    || (a.variant_id === null ? -1 : b.variant_id === null ? 1 : collator.compare(a.variant_nombre ?? '', b.variant_nombre ?? ''))
    || a.id - b.id
  )

  for (const r of fresh) {
    const nuevo = computeNewStock(r.quantity, config)
    const exclusion = exclusionOf(nuevo, r.reserved)
    const status: StockRowStatus = exclusion ? 'excluida' : nuevo === r.quantity ? 'sin_cambio' : 'modificada'
    const agotada = status === 'modificada' && nuevo - r.reserved <= 0
    rows.push({
      id: r.id,
      titulo: r.product_titulo,
      detalle: stockRowDetail(r),
      varianteInactiva: r.variant_id !== null && r.variant_activo === false,
      actual: r.quantity,
      reservado: r.reserved,
      nuevo,
      diferencia: nuevo - r.quantity,
      status,
      exclusion,
      agotada,
    })
    if (status === 'modificada') {
      items.push({ inventory_id: r.id, expected_quantity: r.quantity, quantity: nuevo })
      counts.modificadas++
      if (agotada) counts.agotadas++
    } else if (status === 'sin_cambio') {
      counts.sinCambio++
    } else {
      counts.excluidas++
    }
  }

  for (const s of selected) {
    if (byId.has(s.id)) continue
    rows.push({
      id: s.id,
      titulo: s.titulo,
      detalle: s.variante,
      varianteInactiva: false,
      actual: null,
      reservado: null,
      nuevo: null,
      diferencia: null,
      status: 'excluida',
      exclusion: 'no_disponible',
      agotada: false,
    })
    counts.excluidas++
  }

  return { rows, counts, items, tooManyRows: items.length > MAX_STOCK_ROWS }
}

export function stockChangeMeta(config: StockChangeConfig): StockChangeMeta {
  return { modo: config.modo, valor: config.valor, motivo: config.motivo.trim() }
}

/** "Fijar stock en 10", "Sumar 5 unidades", "Restar 1 unidad" */
export function describeStockChange(meta: { modo?: unknown; valor?: unknown } | null | undefined): string {
  if (!meta || typeof meta.valor !== 'number') return meta?.modo === 'undo' ? 'Deshacer de un cambio anterior' : 'Cambio de stock'
  const valor = meta.valor.toLocaleString('es-AR')
  const unidades = meta.valor === 1 ? 'unidad' : 'unidades'
  if (meta.modo === 'set') return `Fijar stock en ${valor}`
  if (meta.modo === 'add') return `Sumar ${valor} ${unidades}`
  if (meta.modo === 'sub') return `Restar ${valor} ${unidades}`
  return 'Cambio de stock'
}

/** "+5", "−3", "0" */
export function formatDiff(diff: number | null): string {
  if (diff === null) return '—'
  if (diff === 0) return '0'
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('es-AR')}`
}
