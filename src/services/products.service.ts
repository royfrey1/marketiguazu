import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type Publicacion = Database['public']['Tables']['publicaciones']['Row']
type PublicacionInsert = Database['public']['Tables']['publicaciones']['Insert']
type PublicacionUpdate = Database['public']['Tables']['publicaciones']['Update']

export type { Publicacion, PublicacionInsert, PublicacionUpdate }

export const productsService = {
  async getActivePublications() {
    const { data, error } = await supabase
      .from('publicaciones')
      .select('*, categorias(nombre, icono), profiles(id, nombre, whatsapp, direccion, avatar_url)')
      .eq('activo', true)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('publicaciones')
      .select('*, categorias(nombre, icono), profiles(id, nombre, whatsapp, direccion, avatar_url)')
      .eq('id', id)
      .single()

    return { data, error }
  },

  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('publicaciones')
      .select('*, categorias(nombre, icono)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  async getRecent(limit: number) {
    const { data, error } = await supabase
      .from('publicaciones')
      .select('*, categorias(nombre, icono)')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  async getCheapest(limit: number) {
    const { data, error } = await supabase
      .from('publicaciones')
      .select('*, categorias(nombre, icono)')
      .eq('activo', true)
      .order('precio', { ascending: true })
      .limit(limit)

    return { data, error }
  },

  async create(publicacion: PublicacionInsert) {
    const { data, error } = await supabase
      .from('publicaciones')
      .insert(publicacion)
      .select()
      .single()

    return { data, error }
  },

  async update(id: number, updates: PublicacionUpdate) {
    const { data, error } = await supabase
      .from('publicaciones')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  async remove(id: number) {
    const { error } = await supabase
      .from('publicaciones')
      .delete()
      .eq('id', id)

    return { error }
  },

  async toggleActive(id: number, activo: boolean) {
    const { data, error } = await supabase
      .from('publicaciones')
      .update({ activo })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },
}
