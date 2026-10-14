import { supabase } from '../lib/supabase/client'
import { productsService, type Product, type ProductUpdate } from './products.service'
import { productImagesService, PRODUCT_IMAGES_EMBED, type ProductImageRef } from './productImages.service'
import { productVariantsService, type ProductVariant, type VariantFormData } from './productVariants.service'

export interface AdminOfferVariant {
  id: number
  nombre: string
  sku: string
  precio: number
  precioAnterior: number
  descuento: number
  disponible: number
}

export interface AdminOffer {
  productId: number
  titulo: string
  activo: boolean
  imageUrl: string | null
  /** 'producto': la oferta es del producto. 'variantes': la definen sus variantes activas */
  tipo: 'producto' | 'variantes'
  /** Para 'variantes', los de la variante en oferta más barata (igual que la vista) */
  precio: number
  precioAnterior: number
  descuento: number
  /** Stock disponible (cantidad - reservado). Para 'variantes', suma de las variantes en oferta */
  disponible: number
  variantes: AdminOfferVariant[]
}

export interface OfferPrices {
  precio: number
  precio_anterior: number
}

type InventoryItem = { quantity: number; reserved: number; variant_id?: number | null }
/** Desde products llega un array (una fila por producto/variante); desde product_variants, un objeto */
type InventoryRef = InventoryItem[] | InventoryItem | null

const sumAvailable = (inventory: InventoryRef) =>
  (Array.isArray(inventory) ? inventory : inventory ? [inventory] : [])
    .reduce((acc, inv) => acc + (inv.quantity ?? 0) - (inv.reserved ?? 0), 0)

const discountOf = (precio: number, precioAnterior: number) =>
  Math.round(((precioAnterior - precio) / precioAnterior) * 100)

/** Todos los campos que recibe update_admin_product, con los valores actuales de la fila */
export function productRowToUpdate(row: Product): ProductUpdate {
  return {
    titulo: row.titulo,
    slug: row.slug,
    descripcion: row.descripcion,
    marca: row.marca,
    category_id: row.category_id,
    precio: row.precio,
    precio_anterior: row.precio_anterior,
    activo: row.activo,
    destacado: row.destacado,
    peso_envio_gramos: row.peso_envio_gramos,
    alto_paquete_cm: row.alto_paquete_cm,
    ancho_paquete_cm: row.ancho_paquete_cm,
    largo_paquete_cm: row.largo_paquete_cm,
    en_oferta: row.en_oferta,
  }
}

/** Todos los campos que recibe update_product_variant, con los valores actuales de la variante */
export function variantRowToForm(row: ProductVariant): VariantFormData {
  return {
    sku: row.sku,
    nombre: row.nombre,
    precio: row.precio,
    precio_anterior: row.precio_anterior,
    atributos: (row.atributos as Record<string, string> | null) ?? null,
    imagen_url: row.imagen_url,
    activo: row.activo,
    en_oferta: row.en_oferta,
  }
}

export const offersService = {
  /** Ofertas efectivas (vista products_ofertas) con foto, stock y variantes en oferta: 3 consultas en total */
  async listAdmin(): Promise<{ data: AdminOffer[]; error: Error | null }> {
    const { data: rows, error } = await supabase
      .from('products_ofertas')
      .select('id, titulo, activo, imagen_url, oferta_precio, oferta_precio_anterior, oferta_descuento, oferta_variantes_count')
      .eq('en_oferta_efectivo', true)
    if (error) return { data: [], error: new Error(error.message) }

    const offers = (rows ?? []).filter(row => row.id !== null)
    if (offers.length === 0) return { data: [], error: null }
    const ids = offers.map(row => row.id as number)
    const variantProductIds = offers.filter(row => (row.oferta_variantes_count ?? 0) > 0).map(row => row.id as number)

    const [productsRes, variantsRes] = await Promise.all([
      supabase
        .from('products')
        .select(`id, ${PRODUCT_IMAGES_EMBED}, inventory(quantity, reserved, variant_id)`)
        .in('id', ids),
      variantProductIds.length > 0
        ? supabase
            .from('product_variants')
            .select('id, product_id, nombre, sku, precio, precio_anterior, sort_order, inventory(quantity, reserved)')
            .in('product_id', variantProductIds)
            .eq('activo', true)
            .eq('en_oferta', true)
            .order('precio', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ])
    if (productsRes.error) return { data: [], error: new Error(productsRes.error.message) }
    if (variantsRes.error) return { data: [], error: new Error(variantsRes.error.message) }

    const productsById = new Map((productsRes.data ?? []).map(p => [p.id, p as unknown as {
      id: number
      product_images: ProductImageRef[] | null
      inventory: InventoryItem[] | null
    }]))
    const variantsByProduct = new Map<number, AdminOfferVariant[]>()
    for (const v of (variantsRes.data ?? []) as unknown as (ProductVariant & { inventory: InventoryRef })[]) {
      // Mismo criterio que la vista: solo cuenta con descuento real
      if (v.precio_anterior === null || v.precio_anterior <= v.precio) continue
      const list = variantsByProduct.get(v.product_id) ?? []
      list.push({
        id: v.id,
        nombre: v.nombre,
        sku: v.sku,
        precio: v.precio,
        precioAnterior: v.precio_anterior,
        descuento: discountOf(v.precio, v.precio_anterior),
        disponible: sumAvailable(v.inventory),
      })
      variantsByProduct.set(v.product_id, list)
    }

    const data: AdminOffer[] = offers.map(row => {
      const id = row.id as number
      const product = productsById.get(id)
      const variantes = variantsByProduct.get(id) ?? []
      const tipo = (row.oferta_variantes_count ?? 0) > 0 ? 'variantes' : 'producto'
      return {
        productId: id,
        titulo: row.titulo ?? '',
        activo: !!row.activo,
        imageUrl: productImagesService.resolveCoverImageUrl(product?.product_images, row.imagen_url),
        tipo,
        precio: row.oferta_precio ?? 0,
        precioAnterior: row.oferta_precio_anterior ?? 0,
        descuento: row.oferta_descuento ?? 0,
        disponible: tipo === 'variantes'
          ? variantes.reduce((acc, v) => acc + v.disponible, 0)
          // inventory también trae las filas de variantes (con su product_id): solo cuenta la del producto
          : sumAvailable((product?.inventory ?? []).filter(inv => inv.variant_id == null)),
        variantes,
      }
    })

    // Mayor descuento primero; a igual descuento, por nombre
    data.sort((a, b) => b.descuento - a.descuento || a.titulo.localeCompare(b.titulo, 'es'))
    return { data, error: null }
  },

  /**
   * Marca o quita la oferta de un producto sin variantes. Lee la fila fresca y manda TODOS sus
   * valores actuales (la RPC reemplaza todos los campos): solo cambian en_oferta y, si se pasan, los precios.
   */
  async setProductOffer(productId: number, enOferta: boolean, prices?: OfferPrices) {
    const { data: row, error } = await supabase.from('products').select('*').eq('id', productId).single()
    if (error || !row) return { data: null, error: error ?? new Error('Producto no encontrado') }
    return productsService.updateAdminProduct(productId, {
      ...productRowToUpdate(row),
      ...(prices ?? {}),
      en_oferta: enOferta,
    })
  },

  /** Igual que setProductOffer, para una variante (lee la variante fresca y manda la fila completa) */
  async setVariantOffer(variantId: number, enOferta: boolean, prices?: OfferPrices) {
    const { data: row, error } = await productVariantsService.getById(variantId)
    if (error || !row) return { data: null, error: error ?? new Error('Variante no encontrada') }
    return productVariantsService.update(variantId, {
      ...variantRowToForm(row),
      ...(prices ?? {}),
      en_oferta: enOferta,
    })
  },
}
