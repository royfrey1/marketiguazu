// Reglas de ofertas compartidas por el admin (validaciones) y la tienda (qué muestra cada tarjeta).
// Son las mismas que valida la base (CHECK + RPC): descuento real y tope de 90%.

/** Tope duro: precio_anterior <= precio * 10 (= 90% de descuento máximo) */
export const MAX_OFFER_PRICE_RATIO = 10
/** Desde este descuento se muestra una advertencia (no bloquea) */
export const HIGH_DISCOUNT_PCT = 50

/** Descuento entero, con el mismo redondeo que la vista products_ofertas. Null si no hay descuento real. */
export function offerDiscountPct(precio: number | null | undefined, precioAnterior: number | null | undefined): number | null {
  if (!precio || !precioAnterior || precioAnterior <= precio) return null
  return Math.round(((precioAnterior - precio) / precioAnterior) * 100)
}

/** Error bloqueante de una oferta, o null si los precios son válidos */
export function offerPriceError(precio: number | null | undefined, precioAnterior: number | null | undefined): string | null {
  // 0 cuenta como vacío: el esquema del producto convierte el campo vacío en 0
  if (!precioAnterior) {
    return 'Para mostrar la oferta, el precio anterior es obligatorio.'
  }
  if (!precio || precioAnterior <= precio) {
    return 'El precio anterior debe ser mayor que el precio actual.'
  }
  if (precioAnterior > precio * MAX_OFFER_PRICE_RATIO) {
    return `El descuento no puede superar el 90%. Precio anterior máximo: $${(precio * MAX_OFFER_PRICE_RATIO).toLocaleString('es-AR')}.`
  }
  return null
}

export function formatArs(value: number): string {
  return `$${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

// ── Tienda ────────────────────────────────────────────────────────────────

/** Campos de oferta que agrega la vista products_ofertas a cada producto */
export interface ProductOfferFields {
  precio: number
  en_oferta_efectivo?: boolean | null
  oferta_precio?: number | null
  oferta_precio_anterior?: number | null
  oferta_descuento?: number | null
  oferta_variantes_count?: number | null
  oferta_variant_id?: number | null
}

/**
 * Dónde se muestra la tarjeta:
 * - 'offers': bloque de la home, /ofertas y "Solo ofertas" (precio de oferta, también si es de variantes).
 * - 'catalog': resto de la tienda (si la oferta es de variantes, solo el badge, con el precio de siempre).
 */
export type OfferContext = 'offers' | 'catalog'

export interface CardOffer {
  /** Precio a mostrar */
  precio: number
  /** Precio tachado; null si no va tachado */
  precioAnterior: number | null
  /** Porcentaje del badge; null si el badge va sin porcentaje */
  descuento: number | null
  /** Badge "Oferta" visible */
  badge: boolean
  /** "desde" antes del precio (oferta de variantes) */
  desde: boolean
  /** Leyenda "en N variantes" (solo si hay más de una) */
  variantes: string | null
  /** Variante a preseleccionar en la ficha (oferta de variantes en contexto 'offers') */
  variantId: number | null
}

/**
 * Regla visual única de la tienda: tachado, porcentaje y badge solo si la oferta efectiva está
 * marcada y el precio anterior es mayor. Un precio_anterior sin oferta marcada no se tacha.
 */
export function getCardOffer(product: ProductOfferFields, context: OfferContext = 'catalog'): CardOffer {
  const none: CardOffer = { precio: product.precio, precioAnterior: null, descuento: null, badge: false, desde: false, variantes: null, variantId: null }
  const precio = product.oferta_precio
  const precioAnterior = product.oferta_precio_anterior
  if (!product.en_oferta_efectivo || precio == null || precioAnterior == null || precioAnterior <= precio) return none

  const count = product.oferta_variantes_count ?? 0
  const isVariantOffer = count > 0
  // En el catálogo, la oferta de variantes no cambia el precio (un "desde" sería engañoso): solo el badge
  if (isVariantOffer && context === 'catalog') return { ...none, badge: true }

  return {
    precio,
    precioAnterior,
    descuento: product.oferta_descuento ?? offerDiscountPct(precio, precioAnterior),
    badge: true,
    desde: isVariantOffer,
    variantes: count > 1 ? `en ${count} variantes` : null,
    variantId: isVariantOffer ? product.oferta_variant_id ?? null : null,
  }
}

/** Oferta de la ficha: la de la variante seleccionada o, sin variantes, la del producto */
export function isOfferShown(enOferta: boolean | null | undefined, precio: number, precioAnterior: number | null | undefined): boolean {
  return !!enOferta && precioAnterior != null && precioAnterior > precio
}

/** Marco violeta de las tarjetas en contexto de ofertas (bloque de la home y modo ofertas de la búsqueda) */
export const OFFER_CARD_FRAME_CLASS =
  'h-full rounded-xl border border-violet-400/45 bg-white p-1.5 shadow-[0_4px_18px_-8px_rgba(139,92,246,0.28)] transition-all duration-200 hover:border-fuchsia-500/80 hover:shadow-[0_12px_28px_-10px_rgba(217,70,239,0.4)] focus-within:border-fuchsia-500/80 motion-reduce:transition-none [&_.card]:border-0 [&_.card]:shadow-none [&_.card]:hover:shadow-none'
