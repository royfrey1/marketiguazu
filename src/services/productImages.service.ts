import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type ProductImage = Database['public']['Tables']['product_images']['Row']
type ProductImageInsert = Database['public']['Tables']['product_images']['Insert']

export type { ProductImage, ProductImageInsert }

export interface ProductImageRef {
  url: string
  alt_text: string | null
  sort_order: number
  es_principal: boolean
}

const BUCKET = 'publicaciones'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

function resolveImageUrl(
  images: ProductImageRef[] | null | undefined,
  fallbackUrl?: string | null
): string | null {
  if (!images || images.length === 0) return fallbackUrl ?? null

  const principal = images.find((img) => img.es_principal)
  if (principal?.url) return principal.url

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)
  return sorted[0]?.url ?? fallbackUrl ?? null
}

function resolveAltText(
  image: { alt_text?: string | null } | null | undefined,
  productTitle: string
): string {
  return image?.alt_text?.trim() || productTitle
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Formato no permitido. Usá JPG, PNG, WebP o AVIF.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'El archivo supera el límite de 5MB.'
  }
  return null
}

function getStoragePath(url: string): string | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    const idx = parts.indexOf('publicaciones')
    if (idx === -1) return null
    return decodeURIComponent(parts.slice(idx + 1).join('/'))
  } catch {
    return null
  }
}

export const productImagesService = {
  async getByProductId(productId: number) {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })

    return { data, error }
  },

  async upload(productId: number, file: File, userId: string, altText?: string) {
    const validationError = validateFile(file)
    if (validationError) return { data: null, error: new Error(validationError) }

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file)

    if (uploadError) return { data: null, error: uploadError }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    const { data: existing } = await supabase
      .from('product_images')
      .select('id')
      .eq('product_id', productId)

    const isFirst = !existing || existing.length === 0

    const { data: image, error: dbError } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        url: publicUrl,
        alt_text: altText || null,
        sort_order: existing?.length ?? 0,
        es_principal: isFirst,
      })
      .select()
      .single()

    if (dbError) {
      await supabase.storage.from(BUCKET).remove([fileName])
      return { data: null, error: dbError }
    }

    return { data: image, error: null }
  },

  async remove(image: ProductImage) {
    const { error: dbError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', image.id)

    if (dbError) return { error: dbError }

    const storagePath = getStoragePath(image.url)
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath])

      if (storageError) {
        console.error('Storage cleanup failed:', storageError.message)
      }
    }

    if (image.es_principal) {
      const { data: remaining } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', image.product_id)
        .order('sort_order', { ascending: true })
        .limit(1)

      if (remaining && remaining.length > 0) {
        await supabase
          .from('product_images')
          .update({ es_principal: true })
          .eq('id', remaining[0].id)
      }
    }

    return { error: null }
  },

  async setPrincipal(imageId: number, productId: number) {
    await supabase
      .from('product_images')
      .update({ es_principal: false })
      .eq('product_id', productId)
      .eq('es_principal', true)

    const { error } = await supabase
      .from('product_images')
      .update({ es_principal: true })
      .eq('id', imageId)

    return { error }
  },

  async updateAltText(imageId: number, altText: string) {
    const { error } = await supabase
      .from('product_images')
      .update({ alt_text: altText || null })
      .eq('id', imageId)

    return { error }
  },

  async reorder(images: { id: number; sort_order: number }[]) {
    const updates = images.map((img) =>
      supabase
        .from('product_images')
        .update({ sort_order: img.sort_order })
        .eq('id', img.id)
    )

    const results = await Promise.all(updates)
    const firstError = results.find((r) => r.error)
    return { error: firstError?.error ?? null }
  },

  resolveImageUrl,
  resolveAltText,
  validateFile,
}
