import { useEffect } from 'react'
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from '../../config/site'

export interface SeoProps {
  /** Título de la página. Se compone como `${title} | ${SITE_NAME}`. Sin título se usa el de por defecto. */
  title?: string
  description?: string
  /** Ruta absoluta del recurso canonico (sin query ni hash). */
  canonicalPath?: string
  image?: string
  type?: 'website' | 'product'
  noindex?: boolean
  /** Si noindex es true, permite seguir enlaces (por defecto noindex,nofollow). */
  follow?: boolean
  jsonLd?: unknown
}

const SEO_ATTR = 'data-seo'

function absUrl(path?: string): string {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function cleanPath(path: string): string {
  const base = path.split('?')[0].split('#')[0]
  return base.startsWith('/') ? base : `/${base}`
}

function upsert(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  apply(el)
  el.setAttribute(SEO_ATTR, '')
}

function metaByName(name: string, content: string) {
  upsert(
    `meta[name="${name}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute('name', name)
      return el
    },
    el => el.setAttribute('content', content)
  )
}

function metaByProperty(property: string, content: string) {
  upsert(
    `meta[property="${property}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute('property', property)
      return el
    },
    el => el.setAttribute('content', content)
  )
}

function linkCanonical(href: string) {
  upsert(
    'link[rel="canonical"]',
    () => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      return el
    },
    el => el.setAttribute('href', href)
  )
}

function jsonLdScript(json: string) {
  upsert(
    'script[type="application/ld+json"]',
    () => {
      const el = document.createElement('script')
      el.setAttribute('type', 'application/ld+json')
      return el
    },
    el => {
      el.textContent = json
    }
  )
}

// Metas base: las mismas que trae index.html. Al salir de una página se restauran (no se borran),
// así una pantalla sin <Seo> sigue teniendo Open Graph y Twitter.
const DEFAULT_NAME_METAS: Record<string, string> = {
  description: DEFAULT_DESCRIPTION,
  'twitter:card': 'summary_large_image',
  'twitter:title': DEFAULT_TITLE,
  'twitter:description': DEFAULT_DESCRIPTION,
  'twitter:image': DEFAULT_OG_IMAGE,
}
const DEFAULT_PROPERTY_METAS: Record<string, string> = {
  'og:title': DEFAULT_TITLE,
  'og:description': DEFAULT_DESCRIPTION,
  'og:type': 'website',
  'og:url': `${SITE_URL}/`,
  'og:image': DEFAULT_OG_IMAGE,
  'og:site_name': SITE_NAME,
  'og:locale': 'es_AR',
}

function restoreDefaults() {
  // canonical, robots y JSON-LD son propios de cada página: se eliminan
  document.head
    .querySelectorAll(`link[rel="canonical"][${SEO_ATTR}], meta[name="robots"][${SEO_ATTR}], script[type="application/ld+json"][${SEO_ATTR}]`)
    .forEach(el => el.remove())
  document.title = DEFAULT_TITLE
  for (const [name, content] of Object.entries(DEFAULT_NAME_METAS)) metaByName(name, content)
  for (const [property, content] of Object.entries(DEFAULT_PROPERTY_METAS)) metaByProperty(property, content)
}

export default function Seo({
  title,
  description,
  canonicalPath,
  image,
  type = 'website',
  noindex,
  follow,
  jsonLd,
}: SeoProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE
  const desc = description || DEFAULT_DESCRIPTION
  const canonical = canonicalPath ? absUrl(cleanPath(canonicalPath)) : ''
  const ogUrl = canonical || absUrl(window.location.pathname)
  const ogImage = absUrl(image || DEFAULT_OG_IMAGE)
  const jsonLdStr = jsonLd === undefined ? undefined : JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  useEffect(() => {
    document.title = fullTitle
    metaByName('description', desc)
    if (canonical) linkCanonical(canonical)
    metaByProperty('og:title', fullTitle)
    metaByProperty('og:description', desc)
    metaByProperty('og:type', type)
    metaByProperty('og:url', ogUrl)
    metaByProperty('og:image', ogImage)
    metaByProperty('og:site_name', SITE_NAME)
    metaByProperty('og:locale', 'es_AR')
    metaByName('twitter:card', 'summary_large_image')
    metaByName('twitter:title', fullTitle)
    metaByName('twitter:description', desc)
    metaByName('twitter:image', ogImage)
    if (noindex) metaByName('robots', follow ? 'noindex,follow' : 'noindex,nofollow')
    if (jsonLdStr) jsonLdScript(jsonLdStr)
    return restoreDefaults
  }, [fullTitle, desc, canonical, ogUrl, ogImage, type, noindex, follow, jsonLdStr])

  return null
}
