import { supabase } from '../lib/supabase/client'

export const favoritesService = {
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('favorites')
      .select('id, product_id, products(id, titulo, slug, precio, precio_anterior, imagen_url, categories(id, nombre, icono))')
      .eq('user_id', userId)

    return { data, error }
  },

  async check(userId: string, productId: number) {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle()

    return { data, error }
  },

  async add(userId: string, productId: number) {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, product_id: productId })

    return { error }
  },

  async remove(userId: string, productId: number) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId)

    return { error }
  },
}
