import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { adminProductSchema, type AdminProductFormData } from '../../../lib/validations/adminProduct'
import { productsService } from '../../../services/products.service'
import type { Product } from '../../../services/products.service'
import type { Category } from '../../../services/categories.service'
import ProductBasicFields from './ProductBasicFields'
import ProductShippingFields from './ProductShippingFields'

export type { SpecItem } from './ProductSpecificationsEditor'

interface ProductFormProps {
  product?: Product | null
  categories: Category[]
  onSubmit: (data: AdminProductFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  submitLabel?: string
  extraSections?: ReactNode
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormReturn = ReturnType<typeof useForm<any>>

export default function ProductForm({
  product,
  categories,
  onSubmit,
  onCancel,
  loading = false,
  submitLabel,
  extraSections,
}: ProductFormProps) {
  const isEditing = !!product
  const [slugExists, setSlugExists] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  const form = useForm<AdminProductFormData>({
    resolver: zodResolver(adminProductSchema) as never,
    defaultValues: {
      titulo: product?.titulo ?? '',
      slug: product?.slug ?? '',
      descripcion: product?.descripcion ?? '',
      marca: product?.marca ?? '',
      category_id: product?.category_id ?? 0,
      precio: product?.precio ?? 0,
      precio_anterior: product?.precio_anterior ?? '',
      activo: product?.activo ?? true,
      destacado: product?.destacado ?? false,
      peso_envio_gramos: product?.peso_envio_gramos ?? '',
      alto_paquete_cm: product?.alto_paquete_cm ?? '',
      ancho_paquete_cm: product?.ancho_paquete_cm ?? '',
      largo_paquete_cm: product?.largo_paquete_cm ?? '',
    } as never,
  })

  const { handleSubmit } = form

  const handleSlugCheck = useCallback(async (slug: string) => {
    if (!slug) return
    setCheckingSlug(true)
    try {
      const exists = await productsService.checkSlugExists(slug, product?.id)
      setSlugExists(exists)
    } catch {
      setSlugExists(null)
    } finally {
      setCheckingSlug(false)
    }
  }, [product?.id])

  useEffect(() => {
    if (slugExists !== null) {
      setSlugExists(null)
    }
  }, [form.watch('slug')])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFormSubmit = (handleSubmit as any)(async (data: AdminProductFormData) => {
    if (slugExists === true) return
    await onSubmit(data)
  })

  const defaultLabel = isEditing ? 'Guardar cambios' : 'Crear producto'

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <ProductBasicFields
        form={form as unknown as AnyFormReturn}
        categories={categories}
        isEditing={isEditing}
        slugExists={slugExists}
        onSlugCheck={handleSlugCheck}
      />

      <ProductShippingFields form={form as unknown as AnyFormReturn} />

      {/* Full-width sections stacked below the product info (images, specifications) */}
      {extraSections}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-white/60 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg transition-colors disabled:opacity-50 cursor-pointer order-2 sm:order-1"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || checkingSlug || slugExists === true}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 rounded-lg transition-colors disabled:opacity-50 cursor-pointer order-1 sm:order-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            submitLabel || defaultLabel
          )}
        </button>
      </div>
    </form>
  )
}
