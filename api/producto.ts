// /producto/:slug (rewrite en vercel.json): sirve el index.html de la SPA con los metadatos
// reales del producto ya en el <head> (title, description, canonical, og:*, twitter:*), para
// todos los visitantes. La SPA arranca igual por encima y Seo.tsx reescribe las mismas
// etiquetas en el cliente. Solo se inyectan etiquetas que Seo.tsx administra (y limpia al
// navegar): og:image:alt y product:* quedan para cuando Seo.tsx las maneje (Tanda 5).
//
// - 200: shell con metadatos del producto (activo y no eliminado).
// - 301: slug numerico que no es un slug real pero si el id de un producto -> /producto/<slug>.
// - 404: solo si Supabase respondio bien y confirmo que no hay producto (shell + noindex).
// - Cualquier error (Supabase caido, timeout, respuesta rara): shell SIN modificar, 200, no-store.
//   Nunca un 5xx salvo que no haya ninguna plantilla posible.
// Solo lecturas con la clave anon (las mismas variables que api/sitemap.ts). No importa nada de
// src/: las reglas estan duplicadas y cada una dice de donde sale.

// src/config/site.ts
const SITE_URL = 'https://www.iguazumarketplace.com.ar'
const SITE_NAME = 'Iguazú Marketplace'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`

const SUPABASE_TIMEOUT_MS = 2500
const TEMPLATE_TIMEOUT_MS = 2500
const MAX_SLUG_LENGTH = 200
// src/lib/validations/adminProduct.ts solo admite [a-z0-9-]; las mayusculas se consultan
// igual (la busqueda es exacta y dara 404) y cualquier otro caracter es 404 sin consultar
const SLUG_RE = /^[A-Za-z0-9-]+$/

const CACHE_OK = 'public, s-maxage=300, stale-while-revalidate=3600'
const CACHE_NOT_FOUND = 'public, s-maxage=60'
const CACHE_REDIRECT = 'public, s-maxage=3600'
const CACHE_FALLBACK = 'no-store'

export interface ImageRow {
  url: string | null
  sort_order: number
  es_principal: boolean
  variant_id: number | null
  product_variants: { activo: boolean; sort_order: number } | null
}

export interface ProductRow {
  id: number
  slug: string
  titulo: string
  descripcion: string | null
  imagen_url: string | null
  categories: { nombre: string } | null
  product_images: ImageRow[] | null
}

export interface ProductMeta {
  title: string
  description: string
  canonical: string
  image: string
}

class UpstreamError extends Error {}

/** Plazo duro: aborta los fetch y ademas corta la espera aunque algo ignore la senal */
function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new UpstreamError('timeout'))
    }, ms)
  })
  return Promise.race([work(controller.signal), deadline]).finally(() => clearTimeout(timer))
}

// --- Reglas del cliente (duplicadas) ---

/** src/pages/store/ProductPage.tsx (seoDescription): espacios colapsados, 155 max, fallback con la categoria */
export function productDescription(p: Pick<ProductRow, 'titulo' | 'descripcion' | 'categories'>): string {
  const cleanDesc = p.descripcion?.replace(/\s+/g, ' ').trim()
  return cleanDesc
    ? cleanDesc.length > 155
      ? `${cleanDesc.slice(0, 152).trimEnd()}...`
      : cleanDesc
    : `${p.titulo}${p.categories ? ` en ${p.categories.nombre}` : ''}. Comprá con envío gratis a todo el país.`
}

/** src/services/productImages.service.ts (resolveImageUrl): la principal, si no la de menor sort_order */
function principalUrl(images: ImageRow[], fallbackUrl: string | null): string | null {
  if (images.length === 0) return fallbackUrl
  const principal = images.find(img => img.es_principal)
  if (principal?.url) return principal.url
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)
  return sorted[0]?.url ?? fallbackUrl
}

/**
 * src/pages/store/ProductPage.tsx (seoImage): la galeria propia ordenada (principal primero, luego
 * sort_order); si no hay, la portada de productImages.service.ts (resolveCoverImageUrl): imagen_url
 * o la principal de la primera variante activa (sort_order de la variante, luego id).
 */
export function productImage(p: Pick<ProductRow, 'product_images' | 'imagen_url'>): string | null {
  const images = p.product_images ?? []
  const own = images
    .filter(img => img.variant_id == null)
    .sort((a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0) || a.sort_order - b.sort_order)
  if (own[0]?.url) return own[0].url

  if (p.imagen_url) return p.imagen_url

  let first: { order: [number, number]; images: ImageRow[] } | null = null
  const byVariant = new Map<number, ImageRow[]>()
  for (const img of images) {
    if (img.variant_id == null || !img.product_variants?.activo) continue
    const list = byVariant.get(img.variant_id) ?? []
    list.push(img)
    byVariant.set(img.variant_id, list)
  }
  for (const [variantId, list] of byVariant) {
    const order: [number, number] = [list[0].product_variants!.sort_order, variantId]
    if (!first || order[0] < first.order[0] || (order[0] === first.order[0] && order[1] < first.order[1])) {
      first = { order, images: list }
    }
  }
  return first ? principalUrl(first.images, null) : null
}

function absUrl(u: string): string {
  return /^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? u : `/${u}`}`
}

export function buildMeta(p: ProductRow): ProductMeta {
  const image = productImage(p)
  return {
    // src/components/seo/Seo.tsx: `${title} | ${SITE_NAME}`
    title: `${p.titulo} | ${SITE_NAME}`,
    description: productDescription(p),
    canonical: `${SITE_URL}/producto/${p.slug}`,
    image: image ? absUrl(image) : DEFAULT_OG_IMAGE,
  }
}

// --- Inyeccion en el <head> ---

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Reemplaza la primera coincidencia y borra el resto; sin coincidencias, agrega antes de </head> */
function upsertTag(html: string, pattern: RegExp, tag: string): string {
  let done = false
  const out = html.replace(pattern, () => {
    if (done) return ''
    done = true
    return tag
  })
  return done ? out : out.replace('</head>', `    ${tag}\n  </head>`)
}

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${escapeRe(key)}["'][^>]*>`, 'gi')
  return upsertTag(html, pattern, `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`)
}

export function injectProductMeta(html: string, meta: ProductMeta): string {
  let out = upsertTag(html, /<title\b[^>]*>[\s\S]*?<\/title>/gi, `<title>${escapeHtml(meta.title)}</title>`)
  out = setMeta(out, 'name', 'description', meta.description)
  out = upsertTag(
    out,
    /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
  )
  out = setMeta(out, 'property', 'og:title', meta.title)
  out = setMeta(out, 'property', 'og:description', meta.description)
  out = setMeta(out, 'property', 'og:type', 'product')
  out = setMeta(out, 'property', 'og:url', meta.canonical)
  out = setMeta(out, 'property', 'og:image', meta.image)
  out = setMeta(out, 'name', 'twitter:title', meta.title)
  out = setMeta(out, 'name', 'twitter:description', meta.description)
  out = setMeta(out, 'name', 'twitter:image', meta.image)
  return out
}

export function injectNoindex(html: string): string {
  return setMeta(html, 'name', 'robots', 'noindex')
}

// --- Datos (Supabase REST, solo lectura) ---

async function rest<T>(baseUrl: string, anonKey: string, path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new UpstreamError(`Supabase respondio ${res.status}`)
  const data = (await res.json()) as T
  if (!Array.isArray(data)) throw new UpstreamError('Respuesta inesperada de Supabase')
  return data
}

const PRODUCT_SELECT = [
  'id,slug,titulo,descripcion,imagen_url',
  'categories(nombre)',
  'product_images(url,sort_order,es_principal,variant_id,product_variants(activo,sort_order))',
].join(',')

export type Lookup =
  | { kind: 'found'; meta: ProductMeta }
  | { kind: 'redirect'; slug: string }
  | { kind: 'not_found' }

export async function lookupProduct(baseUrl: string, anonKey: string, slug: string, signal: AbortSignal): Promise<Lookup> {
  const active = 'activo=eq.true&deleted_at=is.null'
  const rows = await rest<ProductRow[]>(
    baseUrl,
    anonKey,
    `products?select=${PRODUCT_SELECT}&slug=eq.${encodeURIComponent(slug)}&${active}&limit=1`,
    signal,
  )
  const product = rows[0]

  if (!product) {
    // /producto/<id> numerico: el cliente lo resuelve por id y navega al slug
    if (!/^\d+$/.test(slug) || slug.length > 9) return { kind: 'not_found' }
    const byId = await rest<{ slug: string | null }[]>(
      baseUrl,
      anonKey,
      `products?select=slug&id=eq.${slug}&${active}&limit=1`,
      signal,
    )
    const target = byId[0]?.slug
    return target && target !== slug ? { kind: 'redirect', slug: target } : { kind: 'not_found' }
  }

  return { kind: 'found', meta: buildMeta(product) }
}

// --- Plantilla (index.html del mismo deployment, cacheada en la instancia) ---

let templateCache: string | null = null

export function resetTemplateCache() {
  templateCache = null
}

async function getTemplate(origin: string): Promise<string | null> {
  if (templateCache) return templateCache
  try {
    const html = await withDeadline(async signal => {
      const res = await fetch(`${origin}/index.html`, { signal })
      return res.ok ? res.text() : null
    }, TEMPLATE_TIMEOUT_MS)
    if (html == null) return null
    if (!/<head\b/i.test(html) || !html.includes('</head>') || !/<div id="root">/.test(html)) return null
    templateCache = html
    return html
  } catch {
    return null
  }
}

// --- Handler ---

function slugFrom(url: URL): string | null {
  const fromQuery = url.searchParams.get('slug')
  if (fromQuery != null) return fromQuery
  const m = url.pathname.match(/^\/producto\/([^/]+)\/?$/)
  return m ? m[1] : null
}

function html(body: string | null, status: number, cacheControl: string, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cacheControl, ...extra },
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
    }
    const head = request.method === 'HEAD'
    const url = new URL(request.url)

    const template = await getTemplate(url.origin)
    if (!template) {
      console.error('[producto] sin plantilla index.html')
      return new Response('Servicio no disponible temporalmente\n', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': CACHE_FALLBACK, 'Retry-After': '30' },
      })
    }
    const respond = (body: string, status: number, cacheControl: string, extra?: Record<string, string>) =>
      html(head ? null : body, status, cacheControl, extra)

    let slug = slugFrom(url) ?? ''
    try {
      slug = decodeURIComponent(slug)
    } catch {
      slug = ''
    }
    slug = slug.trim()
    if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_RE.test(slug)) {
      return respond(injectNoindex(template), 404, CACHE_NOT_FOUND)
    }

    const baseUrl = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
    if (!baseUrl || !anonKey) return respond(template, 200, CACHE_FALLBACK)

    let result: Lookup
    try {
      result = await withDeadline(signal => lookupProduct(baseUrl, anonKey, slug, signal), SUPABASE_TIMEOUT_MS)
    } catch (err) {
      // Solo el tipo de falla; nunca datos ni claves
      const reason = err instanceof UpstreamError ? err.message : err instanceof Error ? err.name : 'error'
      console.error(`[producto] fallback al shell: ${reason}`)
      return respond(template, 200, CACHE_FALLBACK)
    }

    if (result.kind === 'redirect') {
      return new Response(null, {
        status: 301,
        headers: { Location: `${SITE_URL}/producto/${encodeURIComponent(result.slug)}`, 'Cache-Control': CACHE_REDIRECT },
      })
    }
    if (result.kind === 'not_found') return respond(injectNoindex(template), 404, CACHE_NOT_FOUND)

    try {
      return respond(injectProductMeta(template, result.meta), 200, CACHE_OK)
    } catch {
      console.error('[producto] fallback al shell: error al inyectar')
      return respond(template, 200, CACHE_FALLBACK)
    }
  },
}
