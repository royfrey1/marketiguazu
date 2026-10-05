import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { categoriesService, type Category } from '../../services/categories.service'
import { productsService, type Product } from '../../services/products.service'
import { productSpecificationsService } from '../../services/productSpecifications.service'
import { useProductSpecifications } from '../../hooks/useProductSpecifications'
import ProductForm from '../../components/admin/products/ProductForm'
import ProductImagesManager from '../../components/admin/products/ProductImagesManager'
import ProductSpecificationsEditor from '../../components/admin/products/ProductSpecificationsEditor'
import ProductVariantsManager from '../../components/admin/products/ProductVariantsManager'
import type { SpecItem } from '../../components/admin/products/ProductSpecificationsEditor'
import type { AdminProductFormData } from '../../lib/validations/adminProduct'
import AdminSubpageHeader from '../../components/admin/AdminSubpageHeader'

export default function ProductEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specsWarning, setSpecsWarning] = useState<string | null>(null)

  const productId = product?.id ?? null
  const specsHook = useProductSpecifications(productId)

  const dbSpecs = useMemo<SpecItem[]>(() => {
    if (!specsHook.data) return []
    return specsHook.data.map(row => ({ name: row.name, value: row.value }))
  }, [specsHook.data])

  const [specsOverride, setSpecsOverride] = useState<SpecItem[] | null>(null)
  const [hasUserEditedSpecs, setHasUserEditedSpecs] = useState(false)

  const specs = useMemo(() => {
    if (hasUserEditedSpecs && specsOverride !== null) return specsOverride
    return dbSpecs
  }, [hasUserEditedSpecs, specsOverride, dbSpecs])

  const [specErrors, setSpecErrors] = useState<{ index: number; field: 'name' | 'value'; message: string }[]>([])

  const handleSpecsChange = useCallback((items: SpecItem[]) => {
    setHasUserEditedSpecs(true)
    setSpecsOverride(items)
    setSpecErrors([])
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const productIdNum = Number(id)
        if (isNaN(productIdNum)) {
          throw new Error('ID de producto invalido')
        }

        const [productRes, catsRes] = await Promise.all([
          productsService.getById(productIdNum),
          categoriesService.getActive(),
        ])

        if (productRes.error) throw productRes.error
        if (!productRes.data) throw new Error('Producto no encontrado')

        if (!cancelled) {
          setProduct(productRes.data)
          setCategories(catsRes.data ?? [])
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Error al cargar el producto')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  const validateSpecs = (): boolean => {
    const errors: { index: number; field: 'name' | 'value'; message: string }[] = []
    specs.forEach((spec, index) => {
      if (!spec.name.trim()) {
        errors.push({ index, field: 'name', message: 'El nombre es obligatorio.' })
      }
      if (!spec.value.trim()) {
        errors.push({ index, field: 'value', message: 'El valor es obligatorio.' })
      }
    })
    setSpecErrors(errors)
    return errors.length === 0
  }

  const handleSubmit = async (data: AdminProductFormData) => {
    if (!user?.id || !product) return

    if (!validateSpecs()) return

    setSubmitting(true)
    setError(null)
    setSpecsWarning(null)

    const trimmedSpecs = specs
      .map((spec, index) => ({
        name: spec.name.trim(),
        value: spec.value.trim(),
        sort_order: index,
      }))
      .filter(spec => spec.name.length > 0 && spec.value.length > 0)

    try {
      const { error: updateError } = await productsService.updateAdminProduct(
        product.id,
        {
          titulo: data.titulo,
          slug: data.slug,
          descripcion: data.descripcion || null,
          marca: data.marca || null,
          category_id: data.category_id,
          precio: data.precio,
          precio_anterior: data.precio_anterior || null,
          activo: data.activo,
          destacado: data.destacado,
          peso_envio_gramos: data.peso_envio_gramos || null,
          alto_paquete_cm: data.alto_paquete_cm || null,
          ancho_paquete_cm: data.ancho_paquete_cm || null,
          largo_paquete_cm: data.largo_paquete_cm || null,
        }
      )

      if (updateError) throw updateError

      if (specsHook.data) {
        const { error: deleteError } = await productSpecificationsService.deleteByProductId(product.id)
        if (deleteError) throw deleteError

        if (trimmedSpecs.length > 0) {
          const inputs = trimmedSpecs.map(spec => ({
            product_id: product.id,
            name: spec.name,
            value: spec.value,
            sort_order: spec.sort_order,
          }))
          const { error: specsError } = await productSpecificationsService.createMany(inputs)
          if (specsError) {
            setSpecsWarning(
              'El producto se actualizó correctamente, pero no se pudieron guardar las especificaciones técnicas. Intentá guardarlas nuevamente desde esta pantalla.'
            )
          }
        }

        specsHook.refetch()
        setHasUserEditedSpecs(false)
        setSpecsOverride(null)
      }

      navigate('/admin/productos')
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('duplicate key') || msg.includes('slug')) {
        setError('Ya existe otro producto con ese slug')
      } else if (msg.includes('foreign key') || msg.includes('categories')) {
        setError('La categoria seleccionada no es valida')
      } else {
        setError(msg || 'Error al guardar el producto')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminSubpageHeader
          title="Editar producto"
          description="Cargando..."
          backHref="/admin/productos"
          backLabel="Volver a productos"
          breadcrumbItems={[
            { label: 'Admin', href: '/admin' },
            { label: 'Productos', href: '/admin/productos' },
            { label: 'Cargando...' },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-6 h-6 text-[#185749] dark:text-[#1CAAA8] animate-spin" />
          <p className="text-sm text-gray-400 dark:text-white/30">Cargando producto...</p>
        </div>
      </div>
    )
  }

  if (error && !product) {
    return (
      <div className="space-y-6">
        <AdminSubpageHeader
          title="Editar producto"
          description="Error"
          backHref="/admin/productos"
          backLabel="Volver a productos"
          breadcrumbItems={[
            { label: 'Admin', href: '/admin' },
            { label: 'Productos', href: '/admin/productos' },
            { label: 'Error' },
          ]}
        />
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight mb-2">Editar producto</h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => navigate('/admin/productos')}
              className="mt-3 text-sm text-[#185749] dark:text-[#1CAAA8] hover:underline cursor-pointer"
            >
              Volver a productos
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminSubpageHeader
        title="Editar producto"
        description={product?.titulo}
        backHref="/admin/productos"
        backLabel="Volver a productos"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin' },
          { label: 'Productos', href: '/admin/productos' },
          { label: 'Editar producto' },
        ]}
      />

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 cursor-pointer shrink-0"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Specs warning */}
      {specsWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">{specsWarning}</p>
            <button
              onClick={() => setSpecsWarning(null)}
              className="text-xs text-amber-500 dark:text-amber-400 hover:text-amber-700 cursor-pointer shrink-0"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Form: info, images and specifications stacked full-width */}
      {product && (
        <ProductForm
          product={product}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/productos')}
          loading={submitting}
          extraSections={
            <>
              {/* Images */}
              <ProductImagesManager productId={product.id} />

              {/* Specifications editor */}
              {specsHook.loading && !hasUserEditedSpecs ? (
                <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <Loader2 className="w-5 h-5 text-[#185749] dark:text-[#1CAAA8] animate-spin" />
                    <p className="text-sm text-gray-400 dark:text-white/30">Cargando especificaciones...</p>
                  </div>
                </div>
              ) : (
                <ProductSpecificationsEditor
                  value={specs}
                  onChange={handleSpecsChange}
                  disabled={submitting}
                  errors={specErrors}
                />
              )}
            </>
          }
        />
      )}

      {/* Variants — full-width, outside the product form */}
      {product && (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Variantes</h2>
          <ProductVariantsManager productId={product.id} />
        </div>
      )}
    </div>
  )
}
