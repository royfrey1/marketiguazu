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
    /** Opción base: un item sin variante de un producto con variantes se muestra con este nombre */
    opcion_base_nombre: string | null
    /** Incluye las fotos de las galerías de variantes (variant_id no nulo) */
    product_images: (ProductImageRef & { variant_id: number | null })[] | null
    /** Variantes del producto: el atributo común da el rótulo de la opción base ("Color: Gris acero") */
    product_variants: { activo: boolean; atributos: Json }[] | null
  } | null
  product_variants: {
    id: number
    nombre: string
    sku: string
    precio: number
    atributos: Json
    imagen_url: string | null
  } | null
  /** Solo invitado: precio guardado en localStorage (para avisar si cambió el vigente) */
  stored_precio_unitario?: number
  /** Solo invitado: stock disponible de la línea (tope del "+") */
  available?: number
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
