const iconModules = import.meta.glob<{ default: string }>(
  '../assets/images/icons/*.png',
  { eager: true }
)

const iconsByUrl = new Map<string, string>()
for (const [path, mod] of Object.entries(iconModules)) {
  const fileName = path.split('/').pop()!.replace('.png', '')
  iconsByUrl.set(fileName, mod.default)
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const knownMappings: Record<string, string> = {
  'smartphones': 'smartphone',
  'monitores': 'monitor',
  'gabinetes': 'gabinete',
  'fuentes': 'fuente',
  'memorias-ram': 'ram',
  'coolers': 'coolerfan',
  'procesadores': 'procesador',
  'consolas': 'consolas',
  'consolas-portatiles': 'consolas',
  'placa-de-video': 'placadevideo',
  'accesorios': 'accesoriospc',
  'accesorios-celulares': 'accesoriospc',
  'perifericos': 'perifericos',
  'motherboards': 'motherboard',
  'almacenamientosssd': 'ssd-almacenamiento',
}

export function getCategoryIcon(slug: string): string | null {
  const knownFile = knownMappings[slug]
  if (knownFile && iconsByUrl.has(knownFile)) {
    return iconsByUrl.get(knownFile)!
  }

  const normSlug = normalize(slug)
  for (const [fileName, url] of iconsByUrl) {
    if (normalize(fileName) === normSlug) return url
  }

  return null
}
