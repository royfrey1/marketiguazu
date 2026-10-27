// /categoria/:slug (rewrite en vercel.json): sirve el index.html de la SPA con los metadatos
// reales de la categoria ya en el <head> (title, description, canonical, og:*, twitter:*), para
// todos los visitantes. La SPA arranca igual por encima y Seo.tsx reescribe las mismas etiquetas.
// Mismo patron que api/producto.ts; el codigo comun (plantilla, escape, reemplazo de etiquetas,
// respuestas) esta duplicado a proposito para no tocar la funcion de fichas con un import entre
// funciones que no se puede probar antes del deploy.
//
// - 200: shell con metadatos de la categoria activa (tenga o no productos visibles: la pagina existe).
// - 404: solo si Supabase respondio bien y confirmo que no hay categoria activa (shell + noindex).
// - Cualquier error (Supabase caido, timeout, respuesta rara): shell SIN modificar, 200, no-store.
//   Nunca un 5xx salvo que no haya ninguna plantilla posible.
// Solo lecturas con la clave anon (las mismas variables que api/sitemap.ts). No importa nada de src/.

// src/config/site.ts
const SITE_URL = 'https://www.iguazumarketplace.com.ar'
const SITE_NAME = 'Iguazú Marketplace'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`

const SUPABASE_TIMEOUT_MS = 2500
const TEMPLATE_TIMEOUT_MS = 2500
const MAX_SLUG_LENGTH = 200
// src/lib/validations/category.ts solo admite [a-z0-9-]; las mayusculas se consultan igual
// (la busqueda es exacta y dara 404) y cualquier otro caracter es 404 sin consultar
const SLUG_RE = /^[A-Za-z0-9-]+$/

const CACHE_OK = 'public, s-maxage=300, stale-while-revalidate=3600'
const CACHE_NOT_FOUND = 'public, s-maxage=60'
const CACHE_FALLBACK = 'no-store'

export interface CategoryRow {
  slug: string
  nombre: string
}

export interface CategoryMeta {
  title: string
  description: string
  canonical: string
  image: string
}

class UpstreamError extends Error {}

/** api/producto.ts: plazo duro que aborta los fetch y corta la espera aunque algo ignore la senal */
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

/**
 * src/pages/store/CategoryPage.tsx (<Seo>): title = nombre (Seo.tsx agrega ` | ${SITE_NAME}`),
 * description fija con el nombre, canonical /categoria/<slug>, sin imagen propia (la tabla no
 * tiene imagen: queda la generica) y og:type por defecto de Seo.tsx ('website').
 */
export function buildMeta(c: CategoryRow): CategoryMeta {
  return {
    title: `${c.nombre} | ${SITE_NAME}`,
    description: `Comprá ${c.nombre} con envío gratis a todo el país.`,
    canonical: `${SITE_URL}/categoria/${c.slug}`,
    image: DEFAULT_OG_IMAGE,
  }
}

// --- Inyeccion en el <head> (igual que api/producto.ts) ---

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

export function injectCategoryMeta(html: string, meta: CategoryMeta): string {
  let out = upsertTag(html, /<title\b[^>]*>[\s\S]*?<\/title>/gi, `<title>${escapeHtml(meta.title)}</title>`)
  out = setMeta(out, 'name', 'description', meta.description)
  out = upsertTag(
    out,
    /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
  )
  out = setMeta(out, 'property', 'og:title', meta.title)
  out = setMeta(out, 'property', 'og:description', meta.description)
  out = setMeta(out, 'property', 'og:type', 'website')
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

/**
 * La categoria existe si hay una activa con ese slug: CategoryPage la busca por slug y la RLS
 * publica (categories_public_read) solo deja ver las activas. Una categoria activa sin productos
 * visibles igual es una pagina valida (200).
 */
export async function lookupCategory(
  baseUrl: string,
  anonKey: string,
  slug: string,
  signal: AbortSignal,
): Promise<CategoryRow | null> {
  const res = await fetch(
    `${baseUrl}/rest/v1/categories?select=slug,nombre&slug=eq.${encodeURIComponent(slug)}&activo=eq.true&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' }, signal },
  )
  if (!res.ok) throw new UpstreamError(`Supabase respondio ${res.status}`)
  const rows = (await res.json()) as CategoryRow[]
  if (!Array.isArray(rows)) throw new UpstreamError('Respuesta inesperada de Supabase')
  const row = rows[0]
  if (row && (typeof row.nombre !== 'string' || typeof row.slug !== 'string')) {
    throw new UpstreamError('Respuesta inesperada de Supabase')
  }
  return row ?? null
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
  const m = url.pathname.match(/^\/categoria\/([^/]+)\/?$/)
  return m ? m[1] : null
}

function html(body: string | null, status: number, cacheControl: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cacheControl },
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
      console.error('[categoria] sin plantilla index.html')
      return new Response('Servicio no disponible temporalmente\n', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': CACHE_FALLBACK, 'Retry-After': '30' },
      })
    }
    const respond = (body: string, status: number, cacheControl: string) =>
      html(head ? null : body, status, cacheControl)

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

    let category: CategoryRow | null
    try {
      category = await withDeadline(signal => lookupCategory(baseUrl, anonKey, slug, signal), SUPABASE_TIMEOUT_MS)
    } catch (err) {
      // Solo el tipo de falla; nunca datos ni claves
      const reason = err instanceof UpstreamError ? err.message : err instanceof Error ? err.name : 'error'
      console.error(`[categoria] fallback al shell: ${reason}`)
      return respond(template, 200, CACHE_FALLBACK)
    }

    if (!category) return respond(injectNoindex(template), 404, CACHE_NOT_FOUND)

    try {
      return respond(injectCategoryMeta(template, buildMeta(category)), 200, CACHE_OK)
    } catch {
      console.error('[categoria] fallback al shell: error al inyectar')
      return respond(template, 200, CACHE_FALLBACK)
    }
  },
}
