import type { Database } from '../lib/supabase/types'
import type { ProductImageRef } from '../services/productImages.service'

type Json = Database['public']['Tables']['product_variants']['Row']['atributos']

export type CartRow = Database['public']['Tables']['carts']['Row']
export type CartItemRow = Database['public']['Tables']['cart_items']['Row']
export type CartItemInsert = Database['public']['Tables']['cart_items']['Insert']

export type CartItemWithProduct = CartItemRow & {
  products: {
    id: number
    titulo: string
    slug: string
    precio: number
    imagen_url: string | null
    activo: boolean
    product_images: ProductImageRef[] | null
  } | null
  product_variants: {
    id: number
    nombre: string
    sku: string
    precio: number
    atributos: Json
    imagen_url: string | null
  } | null
}

export interface LocalCartItem {
  product_id: number
  variant_id: number | null
  cantidad: number
  precio_unitario: number
}

export interface AddCartItemInput {
  product_id: number
  variant_id?: number | null
  cantidad: number
  precio_unitario: number
}
