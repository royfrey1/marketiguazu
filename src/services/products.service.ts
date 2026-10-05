import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'
import { productImagesService, type ProductImageRef } from './productImages.service'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

export type { Product, ProductInsert, ProductUpdate }

export type ProductWithCategory = Product & {
  categories: { nombre: string; icono: string | null } | null
}

export type ProductWithPrimaryImage = ProductWithCategory & {
  product_images: ProductImageRef[] | null
  available: number
}

export type SortOption = 'recent' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc'

export type AdminSortOption = SortOption | 'stock_asc' | 'stock_desc'

export type ProductAdminRow = ProductWithCategory & {
  product_images: ProductImageRef[] | null
  inventory: { quantity: number; reserved: number; low_stock_threshold: number }[] | null
}

export interface AdminProductFilters {
  search?: string
  category_id?: number
  activo?: boolean
  sort?: AdminSortOption
}

export interface CatalogFilters {
  search?: string
  category_id?: number
  category_ids?: number[]
  min_price?: number
  max_price?: number
  marca?: string
  sort?: SortOption
}

export interface CatalogResult {
  data: ProductWithPrimaryImage[]
  total: number
  error: Error | null
}

const DEFAULT_PAGE_SIZE = 24

const IMAGE_SELECT = 'product_images(url, alt_text, sort_order, es_principal)'

let _availabilityCache: Map<number, number> | null = null
let _availabilityPromise: Promise<Map<number, number>> | null = null

async function getProductAvailability(): Promise<Map<number, number>> {
  if (_availabilityCache) return _availabilityCache
  if (_availabilityPromise) return _availabilityPromise

  _availabilityPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_product_availability')
      if (error || !data) return new Map<number, number>()
      const rows = data as { product_id: number; available: number }[]
      const map = new Map<number, number>()
      for (const row of rows) {
        map.set(row.product_id, row.available)
      }
      if (map.size > 0) {
        _availabilityCache = map
      }
      return map
    } catch {
      return new Map<number, number>()
    } finally {
      _availabilityPromise = null
    }
  })()

  return _availabilityPromise
}

export function clearAvailabilityCache() {
  _availabilityCache = null
}

function applySort(
  query: ReturnType<typeof supabase.from>,
  sort: SortOption
) {
  switch (sort) {
    case 'price_asc':
      return query.order('precio', { ascending: true }).order('id', { ascending: true })
    case 'price_desc':
      return query.order('precio', { ascending: false }).order('id', { ascending: true })
    case 'name_asc':
      return query.order('titulo', { ascending: true }).order('id', { ascending: true })
    case 'name_desc':
      return query.order('titulo', { ascending: false }).order('id', { ascending: true })
    case 'recent':
    default:
      return query.order('created_at', { ascending: false }).order('id', { ascending: true })
  }
}

function enrichWithAvailability(
  products: Record<string, unknown>[] | null,
  availability: Map<number, number>
): ProductWithPrimaryImage[] {
  if (!products) return []
  return products.map(p => ({
    ...p,
    available: availability.get((p as { id: number }).id) ?? 0,
  })) as ProductWithPrimaryImage[]
}

export const productsService = {
  async getAllAdmin(
    page: number = 1,
    pageSize: number = 20,
    filters: AdminProductFilters = {}
  ): Promise<{ data: ProductAdminRow[]; total: number; error: Error | null }> {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('products')
      .select(
        `*, categories(nombre, icono), ${IMAGE_SELECT}, inventory(quantity, reserved)`,
        { count: 'exact' }
      )

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim()
      query = query.or(`titulo.ilike.%${term}%,marca.ilike.%${term}%,slug.ilike.%${term}%`)
    }

    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id)
    }

    if (filters.activo !== undefined) {
      query = query.eq('activo', filters.activo)
    }

    const sort = filters.sort || 'recent'
    if (sort === 'stock_asc') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'stock_desc') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = applySort(query, sort as SortOption)
    }

    query = query.range(from, to)

    const { data, error, count } = await query

    return {
      data: (data as ProductAdminRow[]) || [],
      total: count ?? 0,
      error: error ? new Error(error.message) : null,
    }
  },

  async getActiveProducts() {
    const availability = await getProductAvailability()
    const availableIds = [...availability.keys()]
    if (availableIds.length === 0) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from('products')
      .select(`*, categories(nombre, icono, slug), ${IMAGE_SELECT}`)
      .eq('activo', true)
      .in('id', availableIds)
      .order('created_at', { ascending: false })

    return { data: enrichWithAvailability(data, availability), error }
  },

  async getCatalog(
    page: number = 1,
    pageSize: number = DEFAULT_PAGE_SIZE,
    filters: CatalogFilters = {}
  ): Promise<CatalogResult> {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const availability = await getProductAvailability()
    const availableIds = [...availability.keys()]
    if (availableIds.length === 0) {
      return { data: [], total: 0, error: null }
    }

    let query = supabase
      .from('products')
      .select(`*, categories(nombre, icono, slug), ${IMAGE_SELECT}`, { count: 'exact' })
      .eq('activo', true)
      .in('id', availableIds)

    if (filters.search && filters.search.trim()) {
      const termino = filters.search.trim()
      try {
        query = query.textSearch('fts', termino, {
          type: 'plain',
          config: 'spanish',
        })
      } catch {
        const ilikeTerm = `%${termino}%`
        query = query.or(`titulo.ilike.${ilikeTerm},descripcion.ilike.${ilikeTerm},marca.ilike.${ilikeTerm}`)
      }
    }

    if (filters.category_ids && filters.category_ids.length > 0) {
      query = query.in('category_id', filters.category_ids)
    } else if (filters.category_id) {
      query = query.eq('category_id', filters.category_id)
    }

    if (filters.min_price !== undefined && filters.min_price !== null) {
      query = query.gte('precio', filters.min_price)
    }

    if (filters.max_price !== undefined && filters.max_price !== null) {
      query = query.lte('precio', filters.max_price)
    }

    if (filters.marca && filters.marca.trim()) {
      query = query.ilike('marca', filters.marca.trim())
    }

    const sort = filters.sort || 'recent'
    query = applySort(query, sort)

    query = query.range(from, to)

    const { data, error, count } = await query

    return {
      data: enrichWithAvailability(data, availability),
      total: count ?? 0,
      error: error ? new Error(error.message) : null,
    }
  },

  async getBrands(): Promise<string[]> {
    const { data, error } = await supabase
      .from('products')
      .select('marca')
      .eq('activo', true)
      .not('marca', 'is', null)
      .order('marca', { ascending: true })

    if (error || !data) return []

    const brands = [...new Set(data.map((p) => p.marca).filter(Boolean))] as string[]
    return brands
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('products')
      .select(`*, categories(nombre, icono), ${IMAGE_SELECT}`)
      .eq('id', id)
      .single()

    if (!data) return { data: null, error }

    const availability = await getProductAvailability()
    const available = availability.get(data.id) ?? 0
    const product = { ...data, available } as ProductWithPrimaryImage

    return { data: product, error }
  },

  async getBySlug(slug: string) {
    const { data, error } = await supabase
      .from('products')
      .select(`*, categories(nombre, icono, slug), ${IMAGE_SELECT}`)
      .eq('slug', slug)
      .eq('activo', true)
      .single()

    if (!data) return { data: null, error }

    const availability = await getProductAvailability()
    const available = availability.get(data.id) ?? 0
    const product = { ...data, available } as ProductWithPrimaryImage

    return { data: product, error }
  },

  async getRecent(limit: number) {
    const availability = await getProductAvailability()
    const availableIds = [...availability.keys()]
    if (availableIds.length === 0) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from('products')
      .select(`*, categories(nombre, icono, slug), ${IMAGE_SELECT}`)
      .eq('activo', true)
      .in('id', availableIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data: enrichWithAvailability(data, availability), error }
  },

  async getCheapest(limit: number) {
    const availability = await getProductAvailability()
    const availableIds = [...availability.keys()]
    if (availableIds.length === 0) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from('products')
      .select(`*, categories(nombre, icono, slug), ${IMAGE_SELECT}`)
      .eq('activo', true)
      .in('id', availableIds)
      .order('precio', { ascending: true })
      .limit(limit)

    return { data: enrichWithAvailability(data, availability), error }
  },

  async getFeatured(limit: number) {
    const availability = await getProductAvailability()
    const availableIds = [...availability.keys()]
    if (availableIds.length === 0) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from('products')
      .select(`*, categories(nombre, icono, slug), ${IMAGE_SELECT}`)
      .eq('activo', true)
      .eq('destacado', true)
      .in('id', availableIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data: enrichWithAvailability(data, availability), error }
  },

  async create(product: Omit<ProductInsert, 'slug'> & { slug?: string }) {
    const slug = product.slug || product.titulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, slug })
      .select()
      .single()

    return { data, error }
  },

  async update(id: number, updates: ProductUpdate) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  async remove(id: number) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    return { error }
  },

  async toggleActive(id: number, activo: boolean) {
    const { data, error } = await supabase
      .from('products')
      .update({ activo })
      .eq('id', id)
      .select()
      .single()

    if (!error) clearAvailabilityCache()
    return { data, error }
  },

  async toggleDestacado(id: number, destacado: boolean) {
    const { data, error } = await supabase
      .from('products')
      .update({ destacado })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  async checkSlugExists(slug: string, excludeId?: number): Promise<boolean> {
    let query = supabase
      .from('products')
      .select('id')
      .eq('slug', slug)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data } = await query
    return (data?.length ?? 0) > 0
  },

  async createAdminProduct(
    productData: Omit<ProductInsert, 'slug'> & { slug: string }
  ) {
    const { data, error } = await supabase
      .rpc('create_admin_product', {
        p_titulo: productData.titulo,
        p_slug: productData.slug,
        p_category_id: productData.category_id,
        p_precio: productData.precio,
        p_descripcion: productData.descripcion ?? null,
        p_marca: productData.marca ?? null,
        p_precio_anterior: productData.precio_anterior ?? null,
        p_activo: productData.activo ?? true,
        p_destacado: productData.destacado ?? false,
        p_peso_envio_gramos: productData.peso_envio_gramos ?? null,
        p_alto_paquete_cm: productData.alto_paquete_cm ?? null,
        p_ancho_paquete_cm: productData.ancho_paquete_cm ?? null,
        p_largo_paquete_cm: productData.largo_paquete_cm ?? null,
      })
      .single()

    if (error) return { data: null, error }
    clearAvailabilityCache()
    return { data: data as Product, error: null }
  },

  async updateAdminProduct(
    id: number,
    updates: ProductUpdate
  ) {
    const { data, error } = await supabase
      .rpc('update_admin_product', {
        p_product_id: id,
        p_titulo: updates.titulo ?? '',
        p_slug: updates.slug ?? '',
        p_category_id: updates.category_id ?? 0,
        p_precio: updates.precio ?? 0,
        p_descripcion: updates.descripcion ?? null,
        p_marca: updates.marca ?? null,
        p_precio_anterior: updates.precio_anterior ?? null,
        p_activo: updates.activo ?? true,
        p_destacado: updates.destacado ?? false,
        p_peso_envio_gramos: updates.peso_envio_gramos ?? null,
        p_alto_paquete_cm: updates.alto_paquete_cm ?? null,
        p_ancho_paquete_cm: updates.ancho_paquete_cm ?? null,
        p_largo_paquete_cm: updates.largo_paquete_cm ?? null,
      })
      .single()

    if (error) return { data: null, error }
    clearAvailabilityCache()
    return { data: data as Product, error: null }
  },

  resolveImageUrl,

  async getVariantAvailability(productId: number): Promise<Map<number, number>> {
    try {
      const { data, error } = await supabase.rpc('get_variant_availability', {
        p_product_id: productId,
      })
      if (error || !data) return new Map<number, number>()
      const rows = data as { variant_id: number; available: number }[]
      const map = new Map<number, number>()
      for (const row of rows) {
        map.set(row.variant_id, row.available)
      }
      return map
    } catch {
      return new Map<number, number>()
    }
  },
}

function resolveImageUrl(
  product: { product_images?: ProductImageRef[] | null; imagen_url?: string | null } | null | undefined
): string | null {
  return productImagesService.resolveImageUrl(product?.product_images ?? null, product?.imagen_url ?? null)
}
