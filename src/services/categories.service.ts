import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type Category = Database['public']['Tables']['categories']['Row']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export type { Category, CategoryInsert, CategoryUpdate }

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[]
  _count?: { products: number; children: number }
}

export const categoriesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })

    return { data, error }
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  },

  async getActive() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('activo', true)
      .order('sort_order', { ascending: true })

    return { data, error }
  },

  async getRoots() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .is('parent_id', null)
      .eq('activo', true)
      .order('sort_order', { ascending: true })

    return { data, error }
  },

  async getChildren(parentId: number) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true })

    return { data, error }
  },

  async getBySlug(slug: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single()

    return { data, error }
  },

  async getProductCountByCategory() {
    const { data, error } = await supabase
      .from('products')
      .select('category_id')

    if (error) return { data: null, error }

    const counts: Record<number, number> = {}
    for (const row of data ?? []) {
      if (row.category_id) {
        counts[row.category_id] = (counts[row.category_id] ?? 0) + 1
      }
    }
    return { data: counts, error: null }
  },

  async create(category: CategoryInsert) {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single()

    return { data, error }
  },

  async update(id: number, updates: CategoryUpdate) {
    const { data, error } = await supabase
      .from('categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  async remove(id: number) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    return { error }
  },

  async getDescendantIds(categoryId: number): Promise<number[]> {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_id', categoryId)

    if (!data || data.length === 0) return []

    const ids: number[] = data.map((c) => c.id)
    for (const child of data) {
      const deeper = await this.getDescendantIds(child.id)
      ids.push(...deeper)
    }
    return ids
  },
}
