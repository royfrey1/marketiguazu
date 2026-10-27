// /sitemap.xml (rewrite en vercel.json): sitemap dinamico armado con lecturas
// publicas de Supabase (PostgREST + clave anon). Nunca usa service_role ni escribe.
// Ante cualquier falla o dato incompleto responde 503 sin cache: nunca se cachea
// un sitemap vacio ni parcial.

const SITE_URL = 'https://www.iguazumarketplace.com.ar'
const PAGE_SIZE = 1000
/** Por debajo del maximo del protocolo (50.000): al superarlo hay que pasar a un sitemap index */
export const MAX_URLS = 45000

/** Paginas publicas indexables del router (las que tienen <Seo> sin noindex) */
export const STATIC_PATHS = [
  '/',
  '/categoria',
  '/ofertas',
  '/contacto',
  '/preguntas-frecuentes',
  '/nosotros',
  '/envios',
  '/medios-de-pago',
  '/privacidad',
  '/terminos',
  '/devoluciones',
  '/arrepentimiento',
]

export interface SitemapProduct {
  slug: string
  updated_at: string | null
}

export interface SitemapCategory {
  slug: string
}

interface ProductRow {
  id: number
  slug: string | null
  category_id: number | null
  updated_at: string | null
}

interface CategoryRow {
  id: number
  slug: string | null
  parent_id: number | null
}

interface AvailabilityRow {
  product_id: number
  available: number
}

export class SitemapError extends Error {}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** updated_at -> YYYY-MM-DD (W3C); null si no es una fecha valida */
function toW3cDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function byLoc(a: { loc: string }, b: { loc: string }): number {
  return a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0
}

/** Arma el XML: estaticas en orden fijo, luego categorias y productos ordenados por URL, sin duplicados */
export function buildSitemapXml(categories: SitemapCategory[], products: SitemapProduct[]): string {
  const seen = new Set<string>()
  const entries: { loc: string; lastmod: string | null }[] = []
  const push = (loc: string, lastmod: string | null) => {
    if (seen.has(loc)) return
    seen.add(loc)
    entries.push({ loc, lastmod })
  }

  for (const path of STATIC_PATHS) push(path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`, null)

  const categoryEntries = categories
    .filter(c => c.slug)
    .map(c => ({ loc: `${SITE_URL}/categoria/${encodeURIComponent(c.slug)}`, lastmod: null }))
    .sort(byLoc)
  for (const e of categoryEntries) push(e.loc, e.lastmod)

  const productEntries = products
    .filter(p => p.slug)
    .map(p => ({ loc: `${SITE_URL}/producto/${encodeURIComponent(p.slug)}`, lastmod: toW3cDate(p.updated_at) }))
    .sort(byLoc)
  for (const e of productEntries) push(e.loc, e.lastmod)

  if (entries.length > MAX_URLS) {
    throw new SitemapError(`El sitemap tiene ${entries.length} URLs (maximo ${MAX_URLS}): hay que pasar a un sitemap index`)
  }

  const body = entries
    .map(e => `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

/**
 * Elegibilidad de categorias, con la misma logica que /categoria/:slug: la categoria
 * (activa) muestra su subarbol de categorias activas, y en la grilla solo entran
 * productos activos con stock disponible (get_product_availability). Es elegible si
 * algun producto asi cae en su subarbol.
 */
export function eligibleCategories(
  categories: CategoryRow[],
  products: ProductRow[],
  availableIds: Set<number>,
): SitemapCategory[] {
  const parentOf = new Map<number, number | null>()
  for (const c of categories) parentOf.set(c.id, c.parent_id)

  const eligible = new Set<number>()
  for (const p of products) {
    if (p.category_id == null || !availableIds.has(p.id)) continue
    // Sube por los ancestros activos (visited: seguro ante ciclos)
    const visited = new Set<number>()
    let current: number | null | undefined = p.category_id
    while (current != null && parentOf.has(current) && !visited.has(current)) {
      visited.add(current)
      eligible.add(current)
      current = parentOf.get(current)
    }
  }

  return categories.filter(c => eligible.has(c.id) && c.slug).map(c => ({ slug: c.slug as string }))
}

/** GET paginado de a PAGE_SIZE con Range; exige que el total de Content-Range coincida con lo traido */
async function fetchAll<T>(baseUrl: string, anonKey: string, path: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
        'Range-Unit': 'items',
        Range: `${from}-${from + PAGE_SIZE - 1}`,
        Prefer: 'count=exact',
      },
    })
    if (!res.ok && res.status !== 206) throw new SitemapError(`Supabase respondio ${res.status}`)
    const page = (await res.json()) as T[]
    if (!Array.isArray(page)) throw new SitemapError('Respuesta inesperada de Supabase')
    rows.push(...page)

    const total = Number((res.headers.get('content-range') ?? '').split('/')[1])
    if (!Number.isFinite(total)) throw new SitemapError('Supabase no informo el total')
    if (rows.length >= total || page.length === 0) {
      if (rows.length !== total) throw new SitemapError('Datos incompletos de Supabase')
      return rows
    }
  }
}

export async function loadSitemapData(baseUrl: string, anonKey: string) {
  const [products, categories, availability] = await Promise.all([
    fetchAll<ProductRow>(
      baseUrl,
      anonKey,
      'products?select=id,slug,category_id,updated_at&activo=eq.true&deleted_at=is.null&order=id.asc',
    ),
    fetchAll<CategoryRow>(baseUrl, anonKey, 'categories?select=id,slug,parent_id&activo=eq.true&order=id.asc'),
    fetchAll<AvailabilityRow>(baseUrl, anonKey, 'rpc/get_product_availability?order=product_id.asc'),
  ])
  // Sin productos activos no se publica: casi seguro es una falla (RLS, clave, red)
  if (products.length === 0) throw new SitemapError('Supabase no devolvio productos')

  const availableIds = new Set(availability.filter(a => a.available > 0).map(a => a.product_id))
  return {
    products: products.filter(p => p.slug).map(p => ({ slug: p.slug as string, updated_at: p.updated_at })),
    categories: eligibleCategories(categories, products, availableIds),
  }
}

function errorResponse(status: number, message: string): Response {
  return new Response(`${message}\n`, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '600',
    },
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
    }

    const baseUrl = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
    if (!baseUrl || !anonKey) return errorResponse(503, 'Sitemap no disponible: falta configuracion')

    let xml: string
    try {
      const { categories, products } = await loadSitemapData(baseUrl, anonKey)
      xml = buildSitemapXml(categories, products)
    } catch (err) {
      // Solo el mensaje propio; nunca datos ni claves
      const message = err instanceof SitemapError ? err.message : 'error de red'
      console.error(`[sitemap] ${message}`)
      return errorResponse(503, 'Sitemap no disponible temporalmente')
    }

    return new Response(request.method === 'HEAD' ? null : xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  },
}
