// Cómo se muestra una línea del carrito (carrito, resumen y revisión del checkout): rótulo de la opción,
// foto y orden. Solo presentación: no toca precios, claves de línea ni validaciones de stock.
import { productImagesService } from '../services/productImages.service'
import type { CartItemWithProduct } from '../types/cart'

type AttributeMap = Record<string, string>

function asAttributes(value: unknown): AttributeMap | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AttributeMap) : null
}

/**
 * Nombre del atributo de las variantes activas (ej. "Color") si es uno solo y el mismo en todas.
 * Con varios atributos, nombres distintos o datos incompletos devuelve null: no se inventa el atributo.
 */
export function singleVariantAttribute(variants: { activo: boolean; atributos: unknown }[] | null | undefined): string | null {
  const active = (variants ?? []).filter(v => v.activo)
  if (active.length === 0) return null
  let key: string | null = null
  for (const v of active) {
    const keys = Object.keys(asAttributes(v.atributos) ?? {})
    if (keys.length !== 1 || (key !== null && keys[0] !== key)) return null
    key = keys[0]
  }
  return key
}

/** "Color: Dreamscape" para variantes; para la opción base, "Color: Gris acero" o solo el nombre si el atributo no es claro */
export function cartItemOptionLabel(item: CartItemWithProduct): string | null {
  const variant = item.product_variants
  if (variant) {
    const attrs = Object.entries(asAttributes(variant.atributos) ?? {})
    return attrs.length > 0 ? attrs.map(([k, v]) => `${k}: ${v}`).join(' · ') : null
  }
  if (item.variant_id != null) return null
  const nombre = item.products?.opcion_base_nombre?.trim()
  if (!nombre) return null
  const attribute = singleVariantAttribute(item.products?.product_variants)
  return attribute ? `${attribute}: ${nombre}` : nombre
}

/**
 * Foto de la línea: la galería propia de la variante (o su imagen_url heredada) si tiene;
 * si no, la del producto. La opción base usa la del producto. Las fotos de variantes vienen
 * en la misma lista del producto: se separan por variant_id para no mezclar galerías.
 */
export function cartItemImage(item: CartItemWithProduct): { url: string | null; alt: string } {
  const product = item.products
  const titulo = product?.titulo ?? 'Producto'
  const images = product?.product_images ?? []
  // Mismo filtro que las portadas (productImagesService.ownImages). Sin el fallback a la foto de una
  // variante: una línea sin variante (o la opción base) no debe mostrar la foto de otra opción
  const productImages = productImagesService.ownImages(images)
  const productImage = {
    url: productImagesService.resolveImageUrl(productImages, product?.imagen_url),
    alt: productImagesService.resolveAltText(productImages[0], titulo),
  }
  if (item.variant_id == null) return productImage

  const variantImages = images.filter(img => img.variant_id === item.variant_id)
  const variantAlt = `${titulo} - ${item.product_variants?.nombre ?? ''}`.replace(/ - $/, '')
  if (variantImages.length > 0) {
    return {
      url: productImagesService.resolveImageUrl(variantImages),
      alt: productImagesService.resolveAltText(variantImages.find(img => img.es_principal) ?? variantImages[0], variantAlt),
    }
  }
  if (item.product_variants?.imagen_url) return { url: item.product_variants.imagen_url, alt: variantAlt }
  return productImage
}

/**
 * Orden de presentación: las líneas de un mismo producto juntas (en el lugar de su primera línea),
 * la opción base primero y después las variantes, respetando el orden original (estable).
 */
export function groupCartItems<T extends { product_id: number; variant_id: number | null }>(items: T[]): T[] {
  const firstIndex = new Map<number, number>()
  items.forEach((item, i) => {
    if (!firstIndex.has(item.product_id)) firstIndex.set(item.product_id, i)
  })
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) =>
      firstIndex.get(a.item.product_id)! - firstIndex.get(b.item.product_id)! ||
      Number(a.item.variant_id != null) - Number(b.item.variant_id != null) ||
      a.i - b.i
    )
    .map(({ item }) => item)
}
