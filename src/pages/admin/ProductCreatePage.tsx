import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Image as ImageIcon, Loader2 } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { categoriesService, type Category } from '../../services/categories.service'
import { productsService } from '../../services/products.service'
import { productSpecificationsService } from '../../services/productSpecifications.service'
import ProductForm from '../../components/admin/products/ProductForm'
import ProductSpecificationsEditor from '../../components/admin/products/ProductSpecificationsEditor'
import AdminSubpageHeader from '../../components/admin/AdminSubpageHeader'
import type { SpecItem } from '../../components/admin/products/ProductSpecificationsEditor'
import type { AdminProductFormData } from '../../lib/validations/adminProduct'

export default function ProductCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specsWarning, setSpecsWarning] = useState<string | null>(null)
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [specErrors, setSpecErrors] = useState<{ index: number; field: 'name' | 'value'; message: string }[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await categoriesService.getActive()
        if (error) throw error
        if (!cancelled) setCategories(data ?? [])
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Error al cargar categorias')
      } finally {
        if (!cancelled) setLoadingCategories(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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
    if (!user?.id) {
      setError('No hay usuario autenticado')
      return
    }

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
      const { data: product, error: createError } = await productsService.createAdminProduct(
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

      if (createError) throw createError
      if (!product) throw new Error('No se pudo crear el producto')

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
            'El producto se creó correctamente, pero no se pudieron guardar las especificaciones técnicas. Podés agregarlas desde la edición del producto.'
          )
        }
      }

      navigate(`/admin/productos/${product.id}/editar`)
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('duplicate key') || msg.includes('slug')) {
        setError('Ya existe un producto con ese slug')
      } else if (msg.includes('foreign key') || msg.includes('categories')) {
        setError('La categoria seleccionada no es valida')
      } else {
        setError(msg || 'Error al crear el producto')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingCategories) {
    return (
      <div className="space-y-6">
        <AdminSubpageHeader
          title="Nuevo producto"
          description="Cargando..."
          backHref="/admin/productos"
          backLabel="Volver a productos"
          breadcrumbItems={[
            { label: 'Admin', href: '/admin' },
            { label: 'Productos', href: '/admin/productos' },
            { label: 'Nuevo producto' },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-6 h-6 text-[#185749] dark:text-[#1CAAA8] animate-spin" />
          <p className="text-sm text-gray-400 dark:text-white/30">Cargando categorias...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminSubpageHeader
        title="Nuevo producto"
        description="Agregá un nuevo producto al catálogo de Iguazú Marketplace"
        backHref="/admin/productos"
        backLabel="Volver a productos"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin' },
          { label: 'Productos', href: '/admin/productos' },
          { label: 'Nuevo producto' },
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

      {/* Form with two-column layout */}
      <ProductForm
        categories={categories}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/productos')}
        loading={submitting}
        sidebar={
          <>
            {/* Images card */}
            <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-4 h-4 text-gray-400 dark:text-white/30" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70">Imágenes del producto</h3>
              </div>
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg">
                <Package className="w-10 h-10 text-gray-200 dark:text-white/10 mb-3" />
                <p className="text-sm text-gray-500 dark:text-white/40 text-center">
                  Subí imágenes después de crear el producto
                </p>
                <p className="text-xs text-gray-400 dark:text-white/25 text-center mt-1">
                  Desde la pantalla de edición podrás cargar fotos, establecer la imagen principal y gestionar la galería
                </p>
              </div>
            </div>

            {/* Specifications editor */}
            <ProductSpecificationsEditor
              value={specs}
              onChange={(items) => {
                setSpecs(items)
                setSpecErrors([])
              }}
              disabled={submitting}
              errors={specErrors}
            />
          </>
        }
      />
    </div>
  )
}
