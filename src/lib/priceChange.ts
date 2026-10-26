// Cambio masivo de precios (admin): cálculo puro de la vista previa y del lote que se manda a
// apply_price_change_bulk. Las reglas de oferta y de precio son las mismas que valida la base.

import { MAX_OFFER_PRICE_RATIO } from './offers'

export type PriceChangeMode = 'porcentaje' | 'monto' | 'exacto'
export type PriceChangeSign = 'subir' | 'bajar'
export type PriceRounding = 1 | 10 | 100 | 1000

export interface PriceChangeConfig {
  modo: PriceChangeMode
  signo: PriceChangeSign
  valor: number
  redondeo: PriceRounding
}

/** Tope de precio de la base (numeric) */
export const MAX_PRICE = 9999999999
/** Tope de filas (productos + variantes) por llamada: el lote es todo o nada, no se parte */
export const MAX_ROWS_PER_CHANGE = 500
/** Desde esta variación (en valor absoluto) se avisa "Cambio grande"; no bloquea */
export const BIG_CHANGE_PCT = 50
export const MAX_INCREASE_PCT = 1000

export const ROUNDING_OPTIONS: { value: PriceRounding; label: string }[] = [
  { value: 1, label: 'Ninguno' },
  { value: 10, label: '$10' },
  { value: 100, label: '$100' },
  { value: 1000, label: '$1.000' },
]

/**
 * Número escrito en formato es-AR o simple: "1.234,5", "1234,5", "1234.5", "10.000" (miles), "$ 500".
 * Un punto seguido de exactamente 3 dígitos se toma como separador de miles. Null si no es un número.
 */
export function parseDecimalInput(text: string): number | null {
  let s = text.replace(/[\s$]/g, '')
  if (s === '') return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Error de la configuración (o null si se puede calcular la vista previa) */
export function configError(modo: PriceChangeMode, signo: PriceChangeSign, valorText: string): string | null {
  const valor = parseDecimalInput(valorText)
  if (valorText.trim() === '') {
    return modo === 'porcentaje' ? 'Ingresá un porcentaje.' : modo === 'monto' ? 'Ingresá un monto.' : 'Ingresá un precio.'
  }
  if (valor === null) return 'Escribí solo números (por ejemplo 10 o 12,5).'
  if (modo === 'porcentaje') {
    if (valor <= 0) return 'El porcentaje tiene que ser mayor a 0.'
    if (signo === 'bajar' && valor >= 100) return 'Para bajar, el porcentaje tiene que ser menor a 100.'
    if (signo === 'subir' && valor > MAX_INCREASE_PCT) return `El aumento máximo es ${MAX_INCREASE_PCT.toLocaleString('es-AR')}%.`
    return null
  }
  if (valor <= 0) return modo === 'monto' ? 'El monto tiene que ser mayor a 0.' : 'El precio tiene que ser mayor a 0.'
  if (valor > MAX_PRICE) {
    return modo === 'monto' ? 'El monto es demasiado grande.' : `El precio máximo es $${MAX_PRICE.toLocaleString('es-AR')}.`
  }
  return null
}

/** Quita el ruido de punto flotante (1,1 * 100 = 110,00000000000001) */
const clean = (n: number) => Number(n.toPrecision(12))

/** Redondea al múltiplo más cercano (mitad hacia arriba); con 1, al peso entero */
export function roundPrice(value: number, redondeo: PriceRounding): number {
  const steps = clean(value / redondeo)
  return Math.floor(steps + 0.5) * redondeo
}

/** Precio nuevo de una fila (puede quedar <= 0: lo marca la vista previa como inválido) */
export function computeNewPrice(actual: number, config: PriceChangeConfig): number {
  const { modo, signo, valor, redondeo } = config
  const factor = signo === 'subir' ? 1 : -1
  let raw: number
  if (modo === 'porcentaje') raw = (actual * (100 + factor * valor)) / 100
  else if (modo === 'monto') raw = actual + factor * valor
  else raw = valor
  return roundPrice(clean(raw), redondeo)
}

export const isValidPrice = (precio: number) => Number.isFinite(precio) && precio > 0 && precio <= MAX_PRICE

/** Regla de la base: una fila en oferta necesita precio_anterior > precio y <= precio * 10 */
export function isOfferValid(row: { en_oferta: boolean; precio_anterior: number | null }, nuevo: number): boolean {
  if (!row.en_oferta) return true
  return row.precio_anterior !== null && row.precio_anterior > nuevo && row.precio_anterior <= nuevo * MAX_OFFER_PRICE_RATIO
}

/** Variación porcentual (null si el precio actual no es positivo) */
export function changePct(antes: number, despues: number): number | null {
  if (!(antes > 0)) return null
  return clean(((despues - antes) / antes) * 100)
}

// ── Datos leídos y vista previa ──────────────────────────────────────────

export interface PriceVariantData {
  id: number
  product_id: number
  nombre: string
  precio: number
  precio_anterior: number | null
  en_oferta: boolean
  activo: boolean
}

export interface PriceProductData {
  id: number
  titulo: string
  activo: boolean
  deleted_at: string | null
  precio: number
  precio_anterior: number | null
  en_oferta: boolean
  variantes: PriceVariantData[]
}

export type PriceExclusion = 'no_existe' | 'en_papelera' | 'precio_invalido' | 'oferta_invalida'
export type PreviewStatus = 'modificado' | 'sin_cambio' | 'excluido'

export interface PreviewRow {
  /** null en la fila del producto (precio base) */
  variantId: number | null
  nombre: string
  activo: boolean
  antes: number
  despues: number
  cambia: boolean
  variacion: number | null
  grande: boolean
  ofertaInvalida: boolean
  precioInvalido: boolean
}

export interface PreviewProduct {
  id: number
  titulo: string
  status: PreviewStatus
  exclusion: PriceExclusion | null
  /** Null si el producto ya no existe */
  base: PreviewRow | null
  variantes: PreviewRow[]
  grande: boolean
  /** Variantes con precios actuales distintos entre sí */
  variantesDispares: boolean
}

export interface PriceChangeItem {
  product_id: number
  expected_precio: number
  precio: number
  variantes?: { variant_id: number; expected_precio: number; precio: number }[]
}

export interface PriceChangeMeta {
  modo: PriceChangeMode
  signo: PriceChangeSign | null
  valor: number
  redondeo: PriceRounding
}

export interface PricePreview {
  products: PreviewProduct[]
  counts: {
    productosModificados: number
    variantesModificadas: number
    sinCambio: number
    excluidos: number
  }
  /** Lo que se manda: productos incluidos con algún cambio, con TODAS sus filas */
  items: PriceChangeItem[]
  /** Filas (productos + variantes) de items */
  rowCount: number
  /** Modo exacto con productos incluidos cuyas variantes hoy tienen precios distintos */
  needsSamePriceAck: boolean
  tooManyRows: boolean
}

function previewRow(
  row: { precio: number; precio_anterior: number | null; en_oferta: boolean; activo: boolean },
  variantId: number | null,
  nombre: string,
  config: PriceChangeConfig
): PreviewRow {
  const despues = computeNewPrice(row.precio, config)
  const precioInvalido = !isValidPrice(despues)
  const variacion = changePct(row.precio, despues)
  return {
    variantId,
    nombre,
    activo: row.activo,
    antes: row.precio,
    despues,
    cambia: despues !== row.precio,
    variacion,
    grande: variacion !== null && Math.abs(variacion) > BIG_CHANGE_PCT,
    // Se evalúa también si el precio no cambia: la base rechaza cualquier fila en oferta inválida
    ofertaInvalida: !precioInvalido && !isOfferValid(row, despues),
    precioInvalido,
  }
}

export function buildPricePreview(
  selected: { id: number; titulo: string }[],
  data: PriceProductData[],
  config: PriceChangeConfig
): PricePreview {
  const byId = new Map(data.map(p => [p.id, p]))
  const products: PreviewProduct[] = []
  const items: PriceChangeItem[] = []
  let rowCount = 0
  let variantesModificadas = 0
  let needsSamePriceAck = false

  for (const sel of selected) {
    const p = byId.get(sel.id)
    if (!p) {
      products.push({ id: sel.id, titulo: sel.titulo, status: 'excluido', exclusion: 'no_existe', base: null, variantes: [], grande: false, variantesDispares: false })
      continue
    }
    const base = previewRow(p, null, 'Precio base', config)
    const variantes = p.variantes.map(v => previewRow(v, v.id, v.nombre, config))
    const rows = [base, ...variantes]
    const exclusion: PriceExclusion | null = p.deleted_at
      ? 'en_papelera'
      : rows.some(r => r.precioInvalido)
        ? 'precio_invalido'
        : rows.some(r => r.ofertaInvalida)
          ? 'oferta_invalida'
          : null
    const changed = rows.some(r => r.cambia)
    const status: PreviewStatus = exclusion ? 'excluido' : changed ? 'modificado' : 'sin_cambio'
    const variantesDispares = new Set(p.variantes.map(v => v.precio)).size > 1
    products.push({ id: p.id, titulo: p.titulo, status, exclusion, base, variantes, grande: rows.some(r => r.cambia && r.grande), variantesDispares })

    if (status === 'modificado') {
      const item: PriceChangeItem = { product_id: p.id, expected_precio: p.precio, precio: base.despues }
      if (variantes.length > 0) {
        item.variantes = variantes.map(v => ({ variant_id: v.variantId as number, expected_precio: v.antes, precio: v.despues }))
      }
      items.push(item)
      rowCount += 1 + variantes.length
      variantesModificadas += variantes.filter(v => v.cambia).length
      if (config.modo === 'exacto' && variantesDispares) needsSamePriceAck = true
    }
  }

  return {
    products,
    counts: {
      productosModificados: items.length,
      variantesModificadas,
      sinCambio: products.filter(p => p.status === 'sin_cambio').length,
      excluidos: products.filter(p => p.status === 'excluido').length,
    },
    items,
    rowCount,
    needsSamePriceAck,
    tooManyRows: rowCount > MAX_ROWS_PER_CHANGE,
  }
}

export function priceChangeMeta(config: PriceChangeConfig): PriceChangeMeta {
  return {
    modo: config.modo,
    signo: config.modo === 'exacto' ? null : config.signo,
    valor: config.valor,
    redondeo: config.redondeo,
  }
}

/** Resumen legible de un cambio: "Subir 10% · redondeo a $100" */
export function describePriceChange(meta: Partial<PriceChangeMeta> | null | undefined): string {
  if (!meta || !meta.modo || typeof meta.valor !== 'number') return 'Cambio de precios'
  const valor = meta.valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  const verbo = meta.signo === 'bajar' ? 'Bajar' : 'Subir'
  const base = meta.modo === 'porcentaje'
    ? `${verbo} ${valor}%`
    : meta.modo === 'monto'
      ? `${verbo} $${valor}`
      : `Precio exacto $${valor}`
  const rounding = ROUNDING_OPTIONS.find(o => o.value === meta.redondeo && o.value !== 1)
  return rounding ? `${base} · redondeo a ${rounding.label}` : base
}

/** "+10%", "−9,1%", "0%" */
export function formatPct(pct: number | null): string {
  if (pct === null) return '—'
  const abs = Math.abs(pct).toLocaleString('es-AR', { maximumFractionDigits: 1 })
  if (abs === '0') return '0%'
  return `${pct > 0 ? '+' : '−'}${abs}%`
}
