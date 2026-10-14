import { supabase } from '../lib/supabase/client'
import type { CartItemInsert, LocalCartItem } from '../types/cart'
import { guestLineAvailable, lineKey, type GuestCartDetails, type GuestProduct } from '../lib/guestCart'
import { PRODUCT_IMAGES_EMBED } from './productImages.service'
import { productsService } from './products.service'

const CART_ITEM_SELECT = `
  *,
  products(id, titulo, slug, precio, imagen_url, activo, opcion_base_nombre, product_images(url, alt_text, sort_order, es_principal, variant_id), product_variants(activo, atributos)),
  product_variants(id, nombre, sku, precio, atributos, imagen_url)
`

export const cartService = {
  async getActiveCart(userId: string) {
    const { data, error } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    return { data, error }
  },

  async createCart(userId: string) {
    const { data, error } = await supabase
      .from('carts')
      .insert({ user_id: userId, status: 'active' })
      .select()
      .single()

    return { data, error }
  },

  async getOrCreateActiveCart(userId: string) {
    const existing = await this.getActiveCart(userId)
    if (existing.data) return existing
    return this.createCart(userId)
  },

  async getCartItems(cartId: string) {
    const { data, error } = await supabase
      .from('cart_items')
      .select(CART_ITEM_SELECT)
      .eq('cart_id', cartId)
      .order('created_at', { ascending: true })

    return { data, error }
  },

  async addItem(cartId: string, item: Omit<CartItemInsert, 'cart_id'>) {
    let existingQuery = supabase
      .from('cart_items')
      .select('id, cantidad')
      .eq('cart_id', cartId)
      .eq('product_id', item.product_id)

    if (item.variant_id == null) {
      existingQuery = existingQuery.is('variant_id', null)
    } else {
      existingQuery = existingQuery.eq('variant_id', item.variant_id)
    }

    const existing = await existingQuery.maybeSingle()

    if (existing.data) {
      const nuevaCantidad = existing.data.cantidad + (item.cantidad ?? 1)
      return supabase
        .from('cart_items')
        .update({ cantidad: nuevaCantidad })
        .eq('id', existing.data.id)
        .select()
        .single()
    }

    return supabase
      .from('cart_items')
      .insert({ ...item, cart_id: cartId })
      .select()
      .single()
  },

  async updateItemQuantity(cartItemId: number, cantidad: number) {
    if (cantidad <= 0) {
      return this.removeItem(cartItemId)
    }

    const { data, error } = await supabase
      .from('cart_items')
      .update({ cantidad })
      .eq('id', cartItemId)
      .select()
      .single()

    return { data, error }
  },

  async removeItem(cartItemId: number) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId)

    return { error }
  },

  /**
   * Datos para dibujar el carrito de invitado, en lote (sin consultas por línea). Solo lecturas públicas:
   * 1 consulta de productos (con variantes y fotos) + get_product_availability (si hay productos sin
   * variantes) + get_variant_availability por producto con líneas de variante + get_product_base_availability
   * por producto con línea de opción base. Peor caso con MAX_LOCAL_LINES = 30: 31 llamadas (1 + 30), en paralelo.
   * Null si falla la consulta de productos.
   */
  async getGuestCartDetails(lines: Pick<LocalCartItem, 'product_id' | 'variant_id'>[]): Promise<GuestCartDetails | null> {
    const productIds = [...new Set(lines.map(l => l.product_id))]
    const details: GuestCartDetails = {
      products: new Map(),
      productAvailable: new Map(),
      variantAvailable: new Map(),
      baseAvailable: new Map(),
      keys: new Set(lines.map(l => lineKey(l.product_id, l.variant_id))),
    }
    if (productIds.length === 0) return details

    const { data, error } = await supabase
      .from('products')
      .select(`id, titulo, slug, precio, imagen_url, activo, opcion_base_nombre, ${PRODUCT_IMAGES_EMBED}, product_variants(id, nombre, sku, precio, atributos, imagen_url, activo)`)
      .in('id', productIds)
    if (error || !data) return null
    for (const p of data as unknown as GuestProduct[]) details.products.set(p.id, p)

    const hasActiveVariants = (id: number) => (details.products.get(id)?.product_variants ?? []).some(v => v.activo)
    const simpleIds = productIds.filter(id => details.products.has(id) && !hasActiveVariants(id))
    const variantProductIds = [...new Set(lines.filter(l => l.variant_id != null && hasActiveVariants(l.product_id)).map(l => l.product_id))]
    const baseProductIds = [...new Set(lines.filter(l => l.variant_id == null && hasActiveVariants(l.product_id) && details.products.get(l.product_id)?.opcion_base_nombre).map(l => l.product_id))]

    await Promise.all([
      simpleIds.length > 0
        ? supabase.rpc('get_product_availability').then(({ data: rows }) => {
            for (const row of rows ?? []) details.productAvailable.set(row.product_id, row.available)
          })
        : null,
      ...variantProductIds.map(id => productsService.getVariantAvailability(id).then(map => {
        for (const [variantId, available] of map) details.variantAvailable.set(variantId, available)
      })),
      ...baseProductIds.map(id => productsService.getBaseAvailability(id).then(base => {
        if (base) details.baseAvailable.set(id, base.available)
      })),
    ])
    return details
  },

  /** Stock de una línea con las lecturas públicas (invitado: la tabla inventory no es legible) */
  async getPublicLineStock(productId: number, variantId: number | null): Promise<{ available: number; active: boolean } | null> {
    const details = await this.getGuestCartDetails([{ product_id: productId, variant_id: variantId }])
    if (!details) return null
    if (!details.products.has(productId)) return { available: 0, active: false }
    const available = guestLineAvailable(details, productId, variantId)
    const product = details.products.get(productId)!
    const active = variantId != null
      ? !!product.product_variants?.some(v => v.id === variantId && v.activo)
      : !(product.product_variants ?? []).some(v => v.activo) || !!product.opcion_base_nombre
    return { available, active }
  },

  /**
   * Stock disponible (cantidad - reservado) de la fila de inventario de una línea (variante o producto base)
   * y si el producto y la variante siguen activos. Solo lectura; null si no hay fila o falla la consulta.
   */
  async getLineStock(productId: number, variantId: number | null): Promise<{ available: number; active: boolean } | null> {
    let query = supabase
      .from('inventory')
      .select('quantity, reserved, products(activo), product_variants(activo)')
      .eq('product_id', productId)
    query = variantId == null ? query.is('variant_id', null) : query.eq('variant_id', variantId)

    const { data, error } = await query.maybeSingle()
    if (error || !data) return null
    const active = !!data.products?.activo && (variantId == null || !!data.product_variants?.activo)
    return { available: data.quantity - data.reserved, active }
  },

  async clearCart(cartId: string) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)

    return { error }
  },

  async replaceCartItems(cartId: string, localItems: LocalCartItem[]) {
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)

    if (deleteError) return { error: deleteError }

    if (localItems.length === 0) return { error: null }

    const inserts: CartItemInsert[] = localItems.map(item => ({
      cart_id: cartId,
      product_id: item.product_id,
      variant_id: item.variant_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
    }))

    const { error: insertError } = await supabase
      .from('cart_items')
      .insert(inserts)

    return { error: insertError }
  },

  async mergeLocalCart(cartId: string, localItems: LocalCartItem[]) {
    if (localItems.length === 0) return { error: null }

    const { data: existingItems, error: fetchError } = await supabase
      .from('cart_items')
      .select('id, product_id, variant_id, cantidad, precio_unitario')
      .eq('cart_id', cartId)

    if (fetchError) return { error: fetchError }

    const serverMap = new Map<string, { id: number; cantidad: number }>()
    for (const item of existingItems || []) {
      const key = `${item.product_id}_${item.variant_id ?? 'null'}`
      serverMap.set(key, { id: item.id, cantidad: item.cantidad })
    }

    const toInsert: CartItemInsert[] = []
    const toUpdate: { id: number; cantidad: number }[] = []

    for (const local of localItems) {
      const key = `${local.product_id}_${local.variant_id ?? 'null'}`
      const serverItem = serverMap.get(key)

      if (serverItem) {
        toUpdate.push({ id: serverItem.id, cantidad: serverItem.cantidad + local.cantidad })
      } else {
        toInsert.push({
          cart_id: cartId,
          product_id: local.product_id,
          variant_id: local.variant_id,
          cantidad: local.cantidad,
          precio_unitario: local.precio_unitario,
        })
      }
    }

    for (const update of toUpdate) {
      const { error } = await supabase
        .from('cart_items')
        .update({ cantidad: update.cantidad })
        .eq('id', update.id)
      if (error) return { error }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('cart_items')
        .insert(toInsert)
      if (error) return { error }
    }

    return { error: null }
  },
}
