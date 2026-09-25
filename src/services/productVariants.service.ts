import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'
import { clearAvailabilityCache } from './products.service'

type ProductVariant = Database['public']['Tables']['product_variants']['Row']
type ProductVariantInsert = Database['public']['Tables']['product_variants']['Insert']

export type { ProductVariant, ProductVariantInsert }

export interface VariantWithInventory extends ProductVariant {
  inventory: {
    id: number
    quantity: number
    reserved: number
    low_stock_threshold: number
  } | null
}

export interface VariantFormData {
  sku: string
  nombre: string
  precio: number
  precio_anterior?: number | null
  atributos?: Record<string, string> | null
  imagen_url?: string | null
  activo: boolean
}

export const productVariantsService = {
  async getByProductId(productId: number) {
    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        *,
        inventory ( id, quantity, reserved, low_stock_threshold )
      `)
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })

    return { data: data as VariantWithInventory[] | null, error }
  },

  async getActiveByProductId(productId: number) {
    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        *,
        inventory ( id, quantity, reserved, low_stock_threshold )
      `)
      .eq('product_id', productId)
      .eq('activo', true)
      .order('sort_order', { ascending: true })

    return { data: data as VariantWithInventory[] | null, error }
  },

  async getById(variantId: number) {
    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        *,
        inventory ( id, quantity, reserved, low_stock_threshold )
      `)
      .eq('id', variantId)
      .single()

    return { data: data as VariantWithInventory | null, error }
  },

  async create(productId: number, form: VariantFormData) {
    const { data, error } = await supabase
      .rpc('create_product_variant', {
        p_product_id: productId,
        p_sku: form.sku,
        p_nombre: form.nombre,
        p_precio: form.precio,
        p_precio_anterior: form.precio_anterior ?? null,
        p_atributos: form.atributos ? JSON.parse(JSON.stringify(form.atributos)) : null,
        p_imagen_url: form.imagen_url ?? null,
        p_activo: form.activo,
      })
      .single()

    if (!error) clearAvailabilityCache()
    return { data: data as ProductVariant | null, error }
  },

  async update(variantId: number, form: VariantFormData) {
    const { data, error } = await supabase
      .rpc('update_product_variant', {
        p_variant_id: variantId,
        p_sku: form.sku,
        p_nombre: form.nombre,
        p_precio: form.precio,
        p_precio_anterior: form.precio_anterior ?? null,
        p_atributos: form.atributos ? JSON.parse(JSON.stringify(form.atributos)) : null,
        p_imagen_url: form.imagen_url ?? null,
        p_activo: form.activo,
      })
      .single()

    if (!error) clearAvailabilityCache()
    return { data: data as ProductVariant | null, error }
  },

  async remove(variantId: number) {
    const { error } = await supabase
      .rpc('delete_product_variant', {
        p_variant_id: variantId,
      })

    if (!error) clearAvailabilityCache()
    return { error }
  },

  async toggleActive(variantId: number, activo: boolean) {
    const { data, error } = await supabase
      .from('product_variants')
      .update({ activo, updated_at: new Date().toISOString() })
      .eq('id', variantId)
      .select()
      .single()

    if (!error) clearAvailabilityCache()
    return { data: data as ProductVariant | null, error }
  },
}
