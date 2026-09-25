import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type ProductSpecificationRow = Database['public']['Tables']['product_specifications']['Row']
type ProductSpecificationInsert = Database['public']['Tables']['product_specifications']['Insert']
type ProductSpecificationUpdate = Database['public']['Tables']['product_specifications']['Update']

export type { ProductSpecificationRow, ProductSpecificationInsert, ProductSpecificationUpdate }

export interface CreateProductSpecificationInput {
  product_id: number
  name: string
  value: string
  sort_order?: number
}

export interface UpdateProductSpecificationInput {
  name?: string
  value?: string
  sort_order?: number
}

export interface ReorderInput {
  id: number
  sort_order: number
}

export const productSpecificationsService = {
  async getByProductId(productId: number): Promise<{
    data: ProductSpecificationRow[]
    error: Error | null
  }> {
    const { data, error } = await supabase
      .from('product_specifications')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })

    return {
      data: (data as ProductSpecificationRow[]) || [],
      error: error ? new Error(error.message) : null,
    }
  },

  async create(input: CreateProductSpecificationInput): Promise<{
    data: ProductSpecificationRow | null
    error: Error | null
  }> {
    const { data, error } = await supabase
      .from('product_specifications')
      .insert({
        product_id: input.product_id,
        name: input.name,
        value: input.value,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single()

    return {
      data: data as ProductSpecificationRow | null,
      error: error ? new Error(error.message) : null,
    }
  },

  async createMany(inputs: CreateProductSpecificationInput[]): Promise<{
    data: ProductSpecificationRow[]
    error: Error | null
  }> {
    if (inputs.length === 0) return { data: [], error: null }

    const inserts: ProductSpecificationInsert[] = inputs.map((input) => ({
      product_id: input.product_id,
      name: input.name,
      value: input.value,
      sort_order: input.sort_order ?? 0,
    }))

    const { data, error } = await supabase
      .from('product_specifications')
      .insert(inserts)
      .select()

    return {
      data: (data as ProductSpecificationRow[]) || [],
      error: error ? new Error(error.message) : null,
    }
  },

  async update(
    id: number,
    updates: UpdateProductSpecificationInput
  ): Promise<{
    data: ProductSpecificationRow | null
    error: Error | null
  }> {
    const { data, error } = await supabase
      .from('product_specifications')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return {
      data: data as ProductSpecificationRow | null,
      error: error ? new Error(error.message) : null,
    }
  },

  async delete(id: number): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('product_specifications')
      .delete()
      .eq('id', id)

    return { error: error ? new Error(error.message) : null }
  },

  async reorder(items: ReorderInput[]): Promise<{ error: Error | null }> {
    if (items.length === 0) return { error: null }

    const updates = items.map((item) =>
      supabase
        .from('product_specifications')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
    )

    const results = await Promise.all(updates)
    const firstError = results.find((r) => r.error)

    return {
      error: firstError?.error ? new Error(firstError.error.message) : null,
    }
  },

  async deleteByProductId(productId: number): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('product_specifications')
      .delete()
      .eq('product_id', productId)

    return { error: error ? new Error(error.message) : null }
  },
}
