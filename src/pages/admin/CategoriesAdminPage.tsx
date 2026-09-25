import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  categoriesService,
  type Category,
  type CategoryWithChildren,
} from '../../services/categories.service'
import { type CategoryFormData } from '../../lib/validations/category'
import CategoryTree from '../../components/admin/categories/CategoryTree'
import CategoryForm from '../../components/admin/categories/CategoryForm'
import DeleteCategoryDialog from '../../components/admin/categories/DeleteCategoryDialog'
import AdminSubpageHeader from '../../components/admin/AdminSubpageHeader'

type ViewMode = 'list' | 'create' | 'edit'

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([])
  const [productCounts, setProductCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('list')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catsRes, countsRes] = await Promise.all([
        categoriesService.getAll(),
        categoriesService.getProductCountByCategory(),
      ])
      if (catsRes.error) throw catsRes.error
      setCategories(catsRes.data ?? [])
      if (countsRes.data) setProductCounts(countsRes.data)
    } catch (err) {
      setError((err as Error).message || 'Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  const getDescendantIds = (catId: number): number[] => {
    const result: number[] = []
    const find = (id: number) => {
      for (const c of categories) {
        if (c.parent_id === id) {
          result.push(c.id)
          find(c.id)
        }
      }
    }
    find(catId)
    return result
  }

  const handleCreate = async (data: CategoryFormData) => {
    setFormLoading(true)
    setError(null)
    try {
      const slugCheck = await categoriesService.getBySlug(data.slug)
      if (slugCheck.data && !slugCheck.error) {
        setError('Ya existe una categoría con ese slug')
        setFormLoading(false)
        return
      }

      const { error: createError } = await categoriesService.create({
        nombre: data.nombre,
        slug: data.slug,
        icono: data.icono || null,
        parent_id: data.parent_id ?? null,
        activo: data.activo,
        sort_order: data.sort_order,
      })
      if (createError) throw createError
      await loadData()
      setView('list')
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('duplicate key') || msg.includes('slug')) {
        setError('Ya existe una categoría con ese slug')
      } else {
        setError(msg || 'Error al crear la categoría')
      }
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdate = async (data: CategoryFormData) => {
    if (!selectedCategory) return
    setFormLoading(true)
    setError(null)
    try {
      if (data.slug !== selectedCategory.slug) {
        const slugCheck = await categoriesService.getBySlug(data.slug)
        if (slugCheck.data && !slugCheck.error) {
          setError('Ya existe otra categoría con ese slug')
          setFormLoading(false)
          return
        }
      }

      const { error: updateError } = await categoriesService.update(selectedCategory.id, {
        nombre: data.nombre,
        slug: data.slug,
        icono: data.icono || null,
        parent_id: data.parent_id ?? null,
        activo: data.activo,
        sort_order: data.sort_order,
      })
      if (updateError) throw updateError
      await loadData()
      setView('list')
      setSelectedCategory(null)
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('duplicate key') || msg.includes('slug')) {
        setError('Ya existe otra categoría con ese slug')
      } else if (msg.includes('foreign key')) {
        setError('No se puede mover la categoría a esa posición')
      } else {
        setError(msg || 'Error al actualizar la categoría')
      }
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { error: deleteError } = await categoriesService.remove(deleteTarget.id)
      if (deleteError) throw deleteError
      setDeleteTarget(null)
      await loadData()
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('foreign key') || msg.includes('violates')) {
        setError('No se puede eliminar esta categoría porque tiene productos asociados. Desactivarla en su lugar.')
      } else {
        setError(msg || 'Error al eliminar la categoría')
      }
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleActive = async (category: Category) => {
    try {
      const { error } = await categoriesService.update(category.id, {
        activo: !category.activo,
      })
      if (error) throw error
      await loadData()
    } catch (err) {
      setError((err as Error).message || 'Error al cambiar estado')
    }
  }

  const handleEdit = (category: Category) => {
    setSelectedCategory(category)
    setView('edit')
    setError(null)
  }

  const handleDeleteRequest = (category: Category) => {
    setDeleteTarget(category)
    setError(null)
  }

  const handleCancel = () => {
    setView('list')
    setSelectedCategory(null)
    setError(null)
  }

  const title = view === 'create'
    ? 'Crear categoría'
    : view === 'edit'
      ? `Editar: ${selectedCategory?.nombre}`
      : 'Categorías'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">{title}</h1>
            {view === 'list' && (
              <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
                {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
              </p>
            )}
          </div>
        </div>
        {view === 'list' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title="Recargar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setView('create'); setError(null) }}
              className="px-4 py-2.5 text-sm font-medium text-white bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 rounded-lg transition-colors cursor-pointer"
            >
              + Nueva categoría
            </button>
          </div>
        )}
      </div>

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

      {/* List view */}
      {view === 'list' && (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 dark:text-white/30 animate-pulse">Cargando categorías...</p>
            </div>
          ) : (
            <CategoryTree
              categories={categories}
              productCounts={productCounts}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onToggleActive={handleToggleActive}
            />
          )}
        </div>
      )}

      {/* Create / Edit form */}
      {(view === 'create' || view === 'edit') && (
        <>
          <AdminSubpageHeader
            title={view === 'create' ? 'Nueva categoría' : `Editar: ${selectedCategory?.nombre}`}
            backHref="/admin/categorias"
            backLabel="Volver a categorías"
            onBack={handleCancel}
            breadcrumbItems={[
              { label: 'Admin', href: '/admin' },
              { label: 'Categorías', onClick: handleCancel },
              { label: view === 'create' ? 'Nueva categoría' : `Editar: ${selectedCategory?.nombre}` },
            ]}
          />
          <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6 max-w-xl">
          <CategoryForm
            category={selectedCategory}
            parentCategories={categories}
            excludedIds={
              selectedCategory
                ? [selectedCategory.id, ...getDescendantIds(selectedCategory.id)]
                : []
            }
            onSubmit={view === 'create' ? handleCreate : handleUpdate}
            onCancel={handleCancel}
            loading={formLoading}
          />
        </div>
        </>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteCategoryDialog
          category={deleteTarget}
          productCount={productCounts[deleteTarget.id] ?? 0}
          childCount={categories.filter((c) => c.parent_id === deleteTarget.id).length}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}
