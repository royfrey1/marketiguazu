import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'
import { productImagesService, PRODUCT_IMAGES_EMBED, type ProductImageRef } from './productImages.service'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

export type { Product, ProductInsert, ProductUpdate }

export type ProductWithCategory = Product & {
  categories: { nombre: string; icono: string | null } | null
}

/** Columnas de oferta de la vista products_ofertas (las listas de la tienda leen de la vista) */
export interface ProductOfferColumns {
  en_oferta_efectivo?: boolean | null
  oferta_precio?: number | null
  oferta_precio_anterior?: number | null
  oferta_descuento?: number | null
  oferta_variantes_count?: number | null
  oferta_variant_id?: number | null
}

export type ProductWithPrimaryImage = ProductWithCategory & ProductOfferColumns & {
  product_images: ProductImageRef[] | null
  available: number
}

/** 'discount' (mayor descuento) solo aplica en modo ofertas */
export type SortOption = 'recent' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'discount'

export type AdminSortOption = SortOption | 'stock_asc' | 'stock_desc'

/** Oferta efectiva (vista products_ofertas): descuento y, si la oferta está en variantes, cuántas */
export interface AdminOfferInfo {
  descuento: number | null
  variantes: number
}

export type ProductAdminRow = ProductWithCategory & {
  product_images: ProductImageRef[] | null
  inventory: { quantity: number; reserved: number; low_stock_threshold: number }[] | null
  oferta?: AdminOfferInfo | null
}

export interface AdminProductFilters {
  search?: string
  category_id?: number
  activo?: boolean
  /** Solo productos con oferta efectiva (del producto o de alguna variante) */
  en_oferta?: boolean
  sort?: AdminSortOption
  /** Solo la papelera (deleted_at no nulo, la más reciente primero). Sin esto, la papelera queda afuera */
  papelera?: boolean
}

/** Conteos del admin: total/activos/inactivos sin la papelera; la papelera aparte */
export interface AdminProductCounts {
  total: number
  activos: number
  inactivos: number
  papelera: number
}

/** get_admin_product_delete_info (migración product_trash) más los favoritos (null si no se pudieron contar) */
export interface ProductDeleteInfo {
  product_id: number
  titulo: string
  slug: string
  in_trash: boolean
  has_sales: boolean
  sales_count: number
  in_carts: boolean
  carts_count: number
  has_stock: boolean
  stock_total: number
  variant_count: number
  image_count: number
  storage_files: string[]
  favorites_count: number | null
}

/** delete_admin_product_permanent: storage_files son los nombres del bucket a borrar después */
export interface ProductDeleteResult {
  deleted: boolean
  product_id: number
  titulo: string
  stock_removed: number
  storage_files: string[]
}

export type ProductAdminErrorKey =
  | 'FORBIDDEN'
  | 'PRODUCT_NOT_FOUND'
  | 'ALREADY_IN_TRASH'
  | 'NOT_IN_TRASH'
  | 'PRODUCT_IN_TRASH'
  | 'HAS_SALES'
  | 'IN_CARTS'
  | 'STOCK_CONFIRM_REQUIRED'
  | 'SLUG_TAKEN'
  | 'UNKNOWN'

// SQLSTATE propios de la migración product_trash
const PRODUCT_ERROR_CODES: Record<string, Exclude<ProductAdminErrorKey, 'SLUG_TAKEN' | 'UNKNOWN'>> = {
  P4003: 'FORBIDDEN',
  P4004: 'PRODUCT_NOT_FOUND',
  P4041: 'ALREADY_IN_TRASH',
  P4042: 'NOT_IN_TRASH',
  P4043: 'PRODUCT_IN_TRASH',
  P4091: 'HAS_SALES',
  P4092: 'IN_CARTS',
  P4093: 'STOCK_CONFIRM_REQUIRED',
}

const PRODUCT_ERROR_MESSAGES: Record<Exclude<ProductAdminErrorKey, 'UNKNOWN'>, string> = {
  FORBIDDEN: 'No tenés permisos de administrador para hacer esto.',
  PRODUCT_NOT_FOUND: 'El producto ya no existe. Recargá la lista.',
  ALREADY_IN_TRASH: 'El producto ya estaba en la papelera.',
  NOT_IN_TRASH: 'El producto no está en la papelera. Recargá la lista.',
  PRODUCT_IN_TRASH: 'Este producto está en la papelera: restauralo para poder editarlo.',
  HAS_SALES: 'Este producto tuvo ventas: no se puede eliminar definitivamente. Queda en la papelera para conservar el historial.',
  IN_CARTS: 'Este producto está en carritos de clientes. Intentalo de nuevo más tarde.',
  STOCK_CONFIRM_REQUIRED: 'El producto tiene stock: escribí su nombre para confirmar que se pierde.',
  SLUG_TAKEN: 'Ese slug ya está en uso (puede ser un producto en la papelera).',
}

export class ProductAdminError extends Error {
  key: ProductAdminErrorKey
  code: string | null

  constructor(key: ProductAdminErrorKey, message: string, code: string | null) {
    super(message)
    this.name = 'ProductAdminError'
    this.key = key
    this.code = code
  }
}

/** Error de Supabase (error.code = SQLSTATE) a una clave y un mensaje en español */
export function toProductAdminError(error: unknown): ProductAdminError {
  if (error instanceof ProductAdminError) return error
  const { code = null, message = '', details = '' } = (error ?? {}) as { code?: string | null; message?: string; details?: string | null }
  const key = code ? PRODUCT_ERROR_CODES[code] : undefined
  if (key) return new ProductAdminError(key, PRODUCT_ERROR_MESSAGES[key], code)
  if (code === '23505' && `${message} ${details ?? ''}`.includes('products_slug_key')) {
    return new ProductAdminError('SLUG_TAKEN', PRODUCT_ERROR_MESSAGES.SLUG_TAKEN, code)
  }
  return new ProductAdminError('UNKNOWN', message || 'Ocurrió un error inesperado. Intentá de nuevo.', code)
}

export interface CatalogFilters {
  search?: string
  category_id?: number
  category_ids?: number[]
  min_price?: number
  max_price?: number
  marca?: string
  sort?: SortOption
  /** Solo productos con oferta efectiva (modo ofertas): el rango y el orden de precio usan el precio de oferta */
  only_offers?: boolean
}

export interface CatalogResult {
  data: ProductWithPrimaryImage[]
  total: number
  error: Error | null
}

const DEFAULT_PAGE_SIZE = 24

// Incluye las fotos de variantes: resolveImageUrl elige la portada solo entre las propias (con fallback)
const IMAGE_SELECT = PRODUCT_IMAGES_EMBED

/** Listas de la tienda: la vista tiene todas las columnas del producto más las de oferta efectiva */
const STORE_SOURCE = 'products_ofertas'
const STORE_SELECT = `*, categories(nombre, icono, slug), ${IMAGE_SELECT}`

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
  sort: SortOption,
  priceColumn: 'precio' | 'oferta_precio' = 'precio'
) {
  switch (sort) {
    case 'price_asc':
      return query.order(priceColumn, { ascending: true }).order('id', { ascending: true })
    case 'price_desc':
      return query.order(priceColumn, { ascending: false }).order('id', { ascending: true })
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

    query = filters.papelera ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)

    if (filters.activo !== undefined) {
      query = query.eq('activo', filters.activo)
    }

    if (filters.en_oferta) {
      const { data: offerRows, error: offerError } = await supabase
        .from('products_ofertas')
        .select('id')
        .eq('en_oferta_efectivo', true)
      if (offerError) return { data: [], total: 0, error: new Error(offerError.message) }
      const offerIds = (offerRows ?? []).map(row => row.id).filter((id): id is number => id !== null)
      if (offerIds.length === 0) return { data: [], total: 0, error: null }
      query = query.in('id', offerIds)
    }

    const sort = filters.sort || 'recent'
    if (filters.papelera) {
      query = query.order('deleted_at', { ascending: false }).order('id', { ascending: true })
    } else if (sort === 'stock_asc') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'stock_desc') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = applySort(query, sort as SortOption)
    }

    query = query.range(from, to)

    const { data, error, count } = await query
    const rows = (data as ProductAdminRow[]) || []

    // Oferta efectiva de la página en una sola consulta (sin N+1)
    if (!error && rows.length > 0) {
      const { data: offers } = await supabase
        .from('products_ofertas')
        .select('id, oferta_descuento, oferta_variantes_count')
        .eq('en_oferta_efectivo', true)
        .in('id', rows.map(row => row.id))
      const byId = new Map((offers ?? []).map(o => [o.id, o]))
      for (const row of rows) {
        const offer = byId.get(row.id)
        row.oferta = offer ? { descuento: offer.oferta_descuento, variantes: offer.oferta_variantes_count ?? 0 } : null
      }
    }

    return {
      data: rows,
      total: count ?? 0,
      error: error ? new Error(error.message) : null,
    }
  },

  /**
   * Todos los productos de la papelera que coinciden con la búsqueda/categoría (solo id y título), para
   * "Seleccionar los N de la papelera". De a 1000 filas (el límite por consulta de PostgREST).
   */
  async getTrashItems(
    filters: Pick<AdminProductFilters, 'search' | 'category_id'> = {}
  ): Promise<{ data: { id: number; titulo: string }[]; error: Error | null }> {
    const CHUNK = 1000
    const items: { id: number; titulo: string }[] = []
    for (let from = 0; ; from += CHUNK) {
      let query = supabase.from('products').select('id, titulo').not('deleted_at', 'is', null)
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim()
        query = query.or(`titulo.ilike.%${term}%,marca.ilike.%${term}%,slug.ilike.%${term}%`)
      }
      if (filters.category_id) query = query.eq('category_id', filters.category_id)
      const { data, error } = await query
        .order('deleted_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + CHUNK - 1)
      if (error) return { data: [], error: new Error(error.message) }
      items.push(...(data ?? []))
      if (!data || data.length < CHUNK) break
    }
    return { data: items, error: null }
  },

  async getActiveProducts() {
    const availability = await getProductAvailability()
    const availableIds = [...availability.keys()]
    if (availableIds.length === 0) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from(STORE_SOURCE)
      .select(STORE_SELECT)
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
      .from(STORE_SOURCE)
      .select(STORE_SELECT, { count: 'exact' })
      .eq('activo', true)
      .in('id', availableIds)

    // Modo ofertas: lo que se ve es el precio de oferta, así que el rango y el orden de precio van por él
    const priceColumn = filters.only_offers ? 'oferta_precio' : 'precio'
    if (filters.only_offers) {
      query = query.eq('en_oferta_efectivo', true)
    }

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
      query = query.gte(priceColumn, filters.min_price)
    }

    if (filters.max_price !== undefined && filters.max_price !== null) {
      query = query.lte(priceColumn, filters.max_price)
    }

    if (filters.marca && filters.marca.trim()) {
      query = query.ilike('marca', filters.marca.trim())
    }

    // "Mayor descuento" solo existe en modo ofertas; a igual descuento, el más reciente
    const sort = filters.sort === 'discount' && !filters.only_offers ? 'recent' : filters.sort || 'recent'
    query = sort === 'discount'
      ? query
          .order('oferta_descuento', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
      : applySort(query, sort, priceColumn)

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
      .from(STORE_SOURCE)
      .select(STORE_SELECT)
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
      .from(STORE_SOURCE)
      .select(STORE_SELECT)
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
      .from(STORE_SOURCE)
      .select(STORE_SELECT)
      .eq('activo', true)
      .eq('destacado', true)
      .in('id', availableIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data: enrichWithAvailability(data, availability), error }
  },

  /** Productos con oferta efectiva y stock: mayor descuento primero, a igual descuento el más reciente */
  async getOffers(limit = 8) {
    const availability = await getProductAvailability()
    const availableIds = [...availability.keys()]
    if (availableIds.length === 0) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from(STORE_SOURCE)
      .select(STORE_SELECT)
      .eq('activo', true)
      .eq('en_oferta_efectivo', true)
      .in('id', availableIds)
      .order('oferta_descuento', { ascending: false, nullsFirst: false })
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

  async getAdminCounts(): Promise<{ data: AdminProductCounts | null; error: Error | null }> {
    const count = () => supabase.from('products').select('id', { count: 'exact', head: true })
    const [totalRes, activosRes, papeleraRes] = await Promise.all([
      count().is('deleted_at', null),
      count().is('deleted_at', null).eq('activo', true),
      count().not('deleted_at', 'is', null),
    ])
    const error = totalRes.error ?? activosRes.error ?? papeleraRes.error
    if (error) return { data: null, error: new Error(error.message) }
    const total = totalRes.count ?? 0
    const activos = activosRes.count ?? 0
    return { data: { total, activos, inactivos: total - activos, papelera: papeleraRes.count ?? 0 }, error: null }
  },

  /** Papelera: oculta el producto de la tienda (queda inactivo y sin destacar) */
  async archive(id: number): Promise<{ data: Product | null; error: ProductAdminError | null }> {
    const { data, error } = await supabase.rpc('archive_admin_product', { p_product_id: id })
    if (error) return { data: null, error: toProductAdminError(error) }
    clearAvailabilityCache()
    return { data: data as unknown as Product, error: null }
  },

  /** Saca el producto de la papelera; queda inactivo (se reactiva a mano) */
  async restore(id: number): Promise<{ data: Product | null; error: ProductAdminError | null }> {
    const { data, error } = await supabase.rpc('restore_admin_product', { p_product_id: id })
    if (error) return { data: null, error: toProductAdminError(error) }
    return { data: data as unknown as Product, error: null }
  },

  async getDeleteInfo(id: number): Promise<{ data: ProductDeleteInfo | null; error: ProductAdminError | null }> {
    const [infoRes, favoritesRes] = await Promise.all([
      supabase.rpc('get_admin_product_delete_info', { p_product_id: id }),
      supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('product_id', id),
    ])
    if (infoRes.error) return { data: null, error: toProductAdminError(infoRes.error) }
    const info = infoRes.data as unknown as Omit<ProductDeleteInfo, 'favorites_count'>
    return {
      data: { ...info, favorites_count: favoritesRes.error ? null : favoritesRes.count ?? 0 },
      error: null,
    }
  },

  /** Borrado definitivo (solo desde la papelera). Las imágenes de Storage se borran después, con storage_files */
  async deletePermanent(
    id: number,
    confirmStockLoss: boolean
  ): Promise<{ data: ProductDeleteResult | null; error: ProductAdminError | null }> {
    const { data, error } = await supabase.rpc('delete_admin_product_permanent', {
      p_product_id: id,
      p_confirm_stock_loss: confirmStockLoss,
    })
    if (error) return { data: null, error: toProductAdminError(error) }
    clearAvailabilityCache()
    return { data: data as unknown as ProductDeleteResult, error: null }
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
        p_en_oferta: productData.en_oferta ?? false,
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
        // undefined = no se manda y la RPC conserva el valor actual (NULL = "no cambiar")
        p_en_oferta: updates.en_oferta,
        // Opción base: undefined = no se manda y la RPC conserva el valor; '' = quitar; texto = guardar
        p_opcion_base_nombre: updates.opcion_base_nombre,
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

  /**
   * Opción base de un producto con variantes (stock de la fila de inventario sin variante).
   * Null si el producto no la tiene configurada, no está activo o falla la consulta.
   */
  async getBaseAvailability(productId: number): Promise<BaseOptionAvailability | null> {
    try {
      const { data, error } = await supabase.rpc('get_product_base_availability', {
        p_product_id: productId,
      })
      const row = !error && data ? data[0] : undefined
      return row ? { nombre: row.opcion_base_nombre, available: row.available } : null
    } catch {
      return null
    }
  },
}

export interface BaseOptionAvailability {
  nombre: string
  available: number
}

function resolveImageUrl(
  product: { product_images?: ProductImageRef[] | null; imagen_url?: string | null } | null | undefined
): string | null {
  return productImagesService.resolveCoverImageUrl(product?.product_images ?? null, product?.imagen_url ?? null)
}
