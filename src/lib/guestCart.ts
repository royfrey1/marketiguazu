// Carrito de invitado: lectura saneada de localStorage (misma forma de siempre) y armado de las líneas
// con la forma del carrito logueado (CartItemWithProduct) para reutilizar la misma UI.
import type { Database } from './supabase/types'
import type { CartItemWithProduct, LocalCartItem } from '../types/cart'

type Json = Database['public']['Tables']['product_variants']['Row']['atributos']

export const LOCAL_CART_KEY = 'iguazu_cart'
/** Tope de líneas que se leen del almacenamiento (el resto se descarta) */
export const MAX_LOCAL_LINES = 30
/** Tope de cantidad por línea al leer (valores mayores se recortan; el stock decide después) */
export const MAX_LINE_QTY = 999

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0

/** Líneas válidas de localStorage: JSON corrupto o manipulado = carrito vacío; campos inválidos = línea descartada */
export function readLocalCart(): LocalCartItem[] {
  let parsed: unknown
  try {
    const raw = localStorage.getItem(LOCAL_CART_KEY)
    if (!raw) return []
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const byKey = new Map<string, LocalCartItem>()
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const { product_id, variant_id, cantidad, precio_unitario } = entry as Record<string, unknown>
    if (!isPositiveInt(product_id)) continue
    if (variant_id != null && !isPositiveInt(variant_id)) continue
    if (!isPositiveInt(cantidad)) continue
    if (typeof precio_unitario !== 'number' || !Number.isFinite(precio_unitario) || precio_unitario < 0) continue

    const line: LocalCartItem = {
      product_id,
      variant_id: (variant_id as number | null | undefined) ?? null,
      cantidad: Math.min(cantidad, MAX_LINE_QTY),
      precio_unitario,
    }
    const key = lineKey(line.product_id, line.variant_id)
    const existing = byKey.get(key)
    if (existing) {
      existing.cantidad = Math.min(existing.cantidad + line.cantidad, MAX_LINE_QTY)
    } else if (byKey.size < MAX_LOCAL_LINES) {
      byKey.set(key, line)
    }
  }
  return [...byKey.values()]
}

export function writeLocalCart(items: LocalCartItem[]) {
  try {
    localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items))
  } catch {
    // Sin almacenamiento el carrito vive solo en memoria
  }
}

export function clearLocalCart() {
  try {
    localStorage.removeItem(LOCAL_CART_KEY)
  } catch {
    // noop
  }
}

export function lineKey(productId: number, variantId: number | null | undefined): string {
  return `${productId}:${variantId ?? 'base'}`
}

// Ids sintéticos (negativos: nunca chocan con ids reales de cart_items), estables durante la sesión
const idByKey = new Map<string, number>()
const keyById = new Map<number, string>()

export function guestLineId(productId: number, variantId: number | null): number {
  const key = lineKey(productId, variantId)
  let id = idByKey.get(key)
  if (id === undefined) {
    id = -(idByKey.size + 1)
    idByKey.set(key, id)
    keyById.set(id, key)
  }
  return id
}

/** Línea local a la que corresponde un id sintético (o undefined) */
export function guestLineKeyFromId(id: number): string | undefined {
  return keyById.get(id)
}

// ── Detalles para dibujar el carrito ──────────────────────────────────────

export interface GuestProductVariant {
  id: number
  nombre: string
  sku: string
  precio: number
  atributos: Json
  imagen_url: string | null
  activo: boolean
}

export type GuestProduct = Omit<NonNullable<CartItemWithProduct['products']>, 'product_variants'> & {
  product_variants: GuestProductVariant[] | null
}

export interface GuestCartDetails {
  /** Productos visibles (activos: la lectura pública no devuelve inactivos) */
  products: Map<number, GuestProduct>
  /** get_product_availability: productos sin variantes */
  productAvailable: Map<number, number>
  /** get_variant_availability: por id de variante */
  variantAvailable: Map<number, number>
  /** get_product_base_availability: por id de producto (opción base) */
  baseAvailable: Map<number, number>
  /** Claves de línea cubiertas por esta consulta */
  keys: Set<string>
}

/** Stock disponible de una línea según los detalles (0 si no se puede vender) */
export function guestLineAvailable(details: GuestCartDetails, productId: number, variantId: number | null): number {
  const product = details.products.get(productId)
  if (!product) return 0
  if (variantId != null) {
    const variant = product.product_variants?.find(v => v.id === variantId && v.activo)
    return variant ? details.variantAvailable.get(variantId) ?? 0 : 0
  }
  const hasVariants = (product.product_variants ?? []).some(v => v.activo)
  if (hasVariants) {
    // Sin variante, un producto con variantes solo se vende con la opción base configurada
    return product.opcion_base_nombre ? details.baseAvailable.get(productId) ?? 0 : 0
  }
  return details.productAvailable.get(productId) ?? 0
}

/**
 * Líneas de invitado con la forma del carrito logueado. Precio = el vigente (variante o producto);
 * `stored_precio_unitario` guarda el de localStorage para avisar si cambió.
 */
export function buildGuestCart(localItems: LocalCartItem[], details: GuestCartDetails): {
  items: CartItemWithProduct[]
  unavailable: Set<number>
} {
  const unavailable = new Set<number>()
  const items = localItems.map((line): CartItemWithProduct => {
    const id = guestLineId(line.product_id, line.variant_id)
    const product = details.products.get(line.product_id)
    const variant = line.variant_id != null
      ? product?.product_variants?.find(v => v.id === line.variant_id && v.activo) ?? null
      : null
    const available = guestLineAvailable(details, line.product_id, line.variant_id)
    if (!product || available <= 0 || line.cantidad > available) unavailable.add(id)

    // Variante que ya no está: se conserva el precio guardado (la línea queda no disponible)
    const precio = variant
      ? variant.precio
      : line.variant_id != null ? line.precio_unitario : product?.precio ?? line.precio_unitario
    return {
      id,
      cart_id: 'local',
      product_id: line.product_id,
      variant_id: line.variant_id,
      cantidad: line.cantidad,
      precio_unitario: precio,
      created_at: '',
      updated_at: null,
      products: product ?? {
        id: line.product_id,
        titulo: 'Producto no disponible',
        slug: '',
        precio: line.precio_unitario,
        imagen_url: null,
        activo: false,
        opcion_base_nombre: null,
        product_images: [],
        product_variants: [],
      },
      product_variants: variant
        ? { id: variant.id, nombre: variant.nombre, sku: variant.sku, precio: variant.precio, atributos: variant.atributos, imagen_url: variant.imagen_url }
        : null,
      stored_precio_unitario: line.precio_unitario,
      available,
    }
  })
  return { items, unavailable }
}
