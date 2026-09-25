import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'
import { clearAvailabilityCache } from './products.service'

type Inventory = Database['public']['Tables']['inventory']['Row']
type InventoryInsert = Database['public']['Tables']['inventory']['Insert']
type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row']

export type { Inventory, InventoryInsert, InventoryMovement }

export interface InventoryAdminRow {
  id: number
  product_id: number
  variant_id: number | null
  quantity: number
  reserved: number
  available: number
  low_stock_threshold: number
  created_at: string
  updated_at: string | null
  product_titulo: string
  product_slug: string
  product_activo: boolean
  product_imagen_url: string | null
  product_category_id: number | null
  category_nombre: string | null
  variant_nombre: string | null
  variant_sku: string | null
  variant_imagen_url: string | null
  variant_activo: boolean | null
}

export type AdminInventoryFilters = {
  search?: string
  status?: 'all' | 'out_of_stock' | 'low_stock' | 'in_stock'
  sort?: 'product_asc' | 'product_desc' | 'stock_asc' | 'stock_desc' | 'updated_asc' | 'updated_desc'
}

export const inventoryService = {
  async getByProductId(productId: number) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', productId)
      .is('variant_id', null)
      .single()

    return { data, error }
  },

  async createInitialForProduct(productId: number) {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        product_id: productId,
        quantity: 0,
        reserved: 0,
        low_stock_threshold: 5,
      })
      .select()
      .single()

    if (!error) clearAvailabilityCache()
    return { data, error }
  },

  async getAllAdmin(filters: AdminInventoryFilters = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('inventory_admin_view')
      .select('*', { count: 'exact' })

    if (filters.search) {
      query = query.ilike('product_titulo', `%${filters.search}%`)
    }

    if (filters.status === 'out_of_stock') {
      query = query.lte('available', 0)
    } else if (filters.status === 'low_stock') {
      query = query.gt('available', 0)
      query = query.lte('available', 5)
    } else if (filters.status === 'in_stock') {
      query = query.gt('available', 5)
    }

    const sortColumnMap: Record<string, string> = {
      product_asc: 'product_titulo',
      product_desc: 'product_titulo',
      stock_asc: 'available',
      stock_desc: 'available',
      updated_asc: 'updated_at',
      updated_desc: 'updated_at',
    }
    const sort = filters.sort || 'product_asc'
    const column = sortColumnMap[sort] || 'product_titulo'
    const ascending = sort.endsWith('_asc')

    query = query.order(column, { ascending })

    const { data, error, count } = await query

    return { data: data as InventoryAdminRow[] | null, error, count }
  },

  async adjustStock(inventoryId: number, quantity: number, tipo: 'restock' | 'adjustment' | 'return', notas?: string) {
    const { data, error } = await supabase
      .rpc('adjust_stock', {
        p_inventory_id: inventoryId,
        p_quantity: quantity,
        p_tipo: tipo,
        p_notas: notas || null,
      })
      .single()

    if (!error) clearAvailabilityCache()
    return { data: data as Inventory | null, error }
  },

  async getMovements(inventoryId: number) {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select(`
        *,
        profiles ( id, nombre )
      `)
      .eq('inventory_id', inventoryId)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  async updateThreshold(inventoryId: number, threshold: number) {
    const { data, error } = await supabase
      .from('inventory')
      .update({ low_stock_threshold: threshold })
      .eq('id', inventoryId)
      .select()
      .single()

    return { data, error }
  },
}
