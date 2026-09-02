import { supabase } from '../lib/supabase/client'

export const favoritesService = {
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('favoritos')
      .select('id, publicaciones(id, titulo, precio, imagen_url, categorias(nombre, icono))')
      .eq('user_id', userId)

    return { data, error }
  },

  async check(userId: string, publicacionId: number) {
    const { data, error } = await supabase
      .from('favoritos')
      .select('id')
      .eq('user_id', userId)
      .eq('publicacion_id', publicacionId)
      .maybeSingle()

    return { data, error }
  },

  async add(userId: string, publicacionId: number) {
    const { error } = await supabase
      .from('favoritos')
      .insert({ user_id: userId, publicacion_id: publicacionId })

    return { error }
  },

  async remove(userId: string, publicacionId: number) {
    const { error } = await supabase
      .from('favoritos')
      .delete()
      .eq('user_id', userId)
      .eq('publicacion_id', publicacionId)

    return { error }
  },
}
