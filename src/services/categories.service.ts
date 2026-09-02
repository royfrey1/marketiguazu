import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type Categoria = Database['public']['Tables']['categorias']['Row']

export type { Categoria }

export const categoriesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')

    return { data, error }
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  },
}
