import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type AddressRow = Database['public']['Tables']['addresses']['Row']
type AddressInsert = Database['public']['Tables']['addresses']['Insert']
type AddressUpdate = Database['public']['Tables']['addresses']['Update']

export type { AddressRow, AddressInsert, AddressUpdate }

export const addressService = {
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('es_default', { ascending: false })
      .order('created_at', { ascending: false })

    return { data, error }
  },

  async create(address: AddressInsert) {
    const { data, error } = await supabase
      .from('addresses')
      .insert(address)
      .select()
      .single()

    return { data, error }
  },

  async update(id: number, updates: AddressUpdate) {
    const { data, error } = await supabase
      .from('addresses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)

    return { error }
  },

  async setDefault(userId: string, addressId: number) {
    const { error: clearError } = await supabase
      .from('addresses')
      .update({ es_default: false })
      .eq('user_id', userId)
      .eq('es_default', true)

    if (clearError) return { error: clearError }

    const { data, error } = await supabase
      .from('addresses')
      .update({ es_default: true, updated_at: new Date().toISOString() })
      .eq('id', addressId)
      .select()
      .single()

    return { data, error }
  },

  async getDefault(userId: string) {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('es_default', true)
      .single()

    return { data, error }
  },
}
