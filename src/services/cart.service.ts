import { supabase } from '../lib/supabase/client'
import type { CartItemInsert, LocalCartItem } from '../types/cart'

const CART_ITEM_SELECT = `
  *,
  products(id, titulo, slug, precio, imagen_url, activo, product_images(url, alt_text, sort_order, es_principal)),
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
