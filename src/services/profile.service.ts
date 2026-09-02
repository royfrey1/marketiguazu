import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type { Profile, ProfileUpdate }

export const profileService = {
  async getById(id: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  },

  async update(id: string, updates: ProfileUpdate) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  async getVerifiedSellers(limit: number) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nombre, avatar_url')
      .eq('es_vendedor', true)
      .eq('verificado', true)
      .limit(limit)

    return { data, error }
  },
}
