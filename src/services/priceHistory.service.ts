import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type PriceHistoryRow = Database['public']['Tables']['price_history']['Row']

export type { PriceHistoryRow }

export interface PriceHistoryWithProfile extends PriceHistoryRow {
  profiles: { id: string; nombre: string | null } | null
}

export const priceHistoryService = {
  async registerProductPrice(productId: number, precioAnterior: number, precioNuevo: number, userId: string) {
    const { error } = await supabase
      .from('price_history')
      .insert({
        product_id: productId,
        precio_anterior: precioAnterior,
        precio_nuevo: precioNuevo,
        origen: 'manual',
        user_id: userId,
      })

    return { error }
  },

  async getByVariantId(variantId: number) {
    const { data, error } = await supabase
      .from('price_history')
      .select('*, profiles ( id, nombre )')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })

    return { data: data as PriceHistoryWithProfile[] | null, error }
  },

  async getByProductId(productId: number) {
    const { data, error } = await supabase
      .from('price_history')
      .select('*, profiles ( id, nombre )')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    return { data: data as PriceHistoryWithProfile[] | null, error }
  },
}
