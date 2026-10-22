import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { sileo } from 'sileo'
import { useAdminProducts, useActiveCategories } from '../../hooks/useAdminProducts'
import {
  productsService,
  type ProductAdminRow,
  type AdminProductFilters,
  type AdminProductCounts,
} from '../../services/products.service'
import ProductFilters from '../../components/admin/products/ProductFilters'
import ProductTable from '../../components/admin/products/ProductTable'
import ProductPagination from '../../components/admin/products/ProductPagination'
import DeleteProductDialog from '../../components/admin/products/DeleteProductDialog'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'

type ProductsView = 'productos' | 'papelera'

// Foco inicial en Cancelar: showModal() respeta el atributo autofocus
const autofocusRef = (el: HTMLElement | null) => el?.setAttribute('autofocus', '')

export default function ProductsAdminPage() {
  const [view, setView] = useState<ProductsView>('productos')
  const [filters, setFilters] = useState<AdminProductFilters>({})
  const listFilters = useMemo<AdminProductFilters>(
    () => (view === 'papelera' ? { ...filters, papelera: true } : filters),
    [view, filters]
  )
  const {
    data: products,
    total,
    page,
    loading,
    error,
    totalPages,
    hasNext,
    hasPrev,
    goToPage,
    refetch,
  } = useAdminProducts({ filters: listFilters })
  const { categories } = useActiveCategories()
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [counts, setCounts] = useState<AdminProductCounts | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ProductAdminRow | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductAdminRow | null>(null)
  const restoringRef = useRef(new Set<number>())

  const loadCounts = useCallback(
    () => productsService.getAdminCounts().then(({ data }) => { if (data) setCounts(data) }),
    []
  )

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  const refreshAll = useCallback(() => {
    refetch()
    void loadCounts()
  }, [refetch, loadCounts])

  // Si la página quedó vacía (se movió su último producto), volver a la anterior
  useEffect(() => {
    if (!loading && products.length === 0 && page > 1) goToPage(page - 1)
  }, [loading, products.length, page, goToPage])

  const changeView = (next: ProductsView) => {
    if (next === view) return
    setView(next)
    setFilters({})
    setActionError(null)
  }

  const handleRestore = useCallback(async (product: ProductAdminRow) => {
    if (restoringRef.current.has(product.id)) return
    restoringRef.current.add(product.id)
    setActionLoading(product.id)
    const { error } = await productsService.restore(product.id)
    restoringRef.current.delete(product.id)
    setActionLoading(null)
    if (error) {
      sileo.error({ title: 'No se pudo restaurar el producto', description: error.message })
      if (error.key === 'NOT_IN_TRASH' || error.key === 'PRODUCT_NOT_FOUND') refreshAll()
      return
    }
    sileo.success({ title: 'Producto restaurado', description: 'Quedó inactivo: activalo cuando quieras.' })
    refreshAll()
  }, [refreshAll])

  const confirmArchive = async () => {
    if (!archiveTarget || archiving) return
    const product = archiveTarget
    setArchiving(true)
    const { error } = await productsService.archive(product.id)
    setArchiving(false)
    setArchiveTarget(null)
    if (error) {
      sileo.error({ title: 'No se pudo enviar a la papelera', description: error.message })
      if (error.key === 'ALREADY_IN_TRASH' || error.key === 'PRODUCT_NOT_FOUND') refreshAll()
      return
    }
    // Deshacer = restaurar (una sola vez; queda inactivo, como cualquier restauración)
    let undone = false
    sileo.action({
      title: 'Producto enviado a la papelera',
      description: product.titulo,
      button: {
        title: 'Deshacer',
        onClick: () => {
          if (undone) return
          undone = true
          void handleRestore(product)
        },
      },
    })
    refreshAll()
  }

  const handleToggleActive = useCallback(async (product: ProductAdminRow) => {
    setActionLoading(product.id)
    setActionError(null)
    try {
      const { error } = await productsService.toggleActive(product.id, !product.activo)
      if (error) throw error
      refetch()
    } catch (err) {
      setActionError(`Error al ${product.activo ? 'desactivar' : 'activar'} "${product.titulo}": ${(err as Error).message}`)
    } finally {
      setActionLoading(null)
    }
  }, [refetch])

  const handleToggleDestacado = useCallback(async (product: ProductAdminRow) => {
    setActionLoading(product.id)
    setActionError(null)
    try {
      const { error } = await productsService.toggleDestacado(product.id, !product.destacado)
      if (error) throw error
      refetch()
    } catch (err) {
      setActionError(`Error al ${product.destacado ? 'quitar destacado' : 'destacar'} "${product.titulo}": ${(err as Error).message}`)
    } finally {
      setActionLoading(null)
    }
  }, [refetch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Productos</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
            Gestioná el catálogo de productos de tu tienda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshAll()}
            className="p-2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title="Recargar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/admin/productos/nuevo"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </div>
      </div>

      {/* Error */}
      {(error || actionError) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{actionError || error}</p>
          {actionError && (
            <button
              onClick={() => setActionError(null)}
              className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 mt-1 cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      )}

      {/* Productos | Papelera */}
      <div role="tablist" aria-label="Vista" className="flex gap-1 border-b border-gray-200 dark:border-white/10">
        {([
          { key: 'productos', label: 'Productos', count: counts?.total },
          { key: 'papelera', label: 'Papelera', count: counts?.papelera },
        ] as const).map(tab => {
          const selected = view === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => changeView(tab.key)}
              className={`-mb-px inline-flex items-center gap-1.5 min-h-11 px-4 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                selected
                  ? 'border-[#185749] dark:border-[#1CAAA8] text-[#185749] dark:text-[#1CAAA8]'
                  : 'border-transparent text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
              }`}
            >
              {tab.key === 'papelera' && <Trash2 className="w-4 h-4" aria-hidden="true" />}
              {tab.label}
              {tab.count !== undefined && <span className="tabular-nums">({tab.count})</span>}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <ProductFilters
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
        total={total}
        trash={view === 'papelera'}
      />

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {/* Desktop skeleton */}
          <div className="hidden lg:block bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="flex items-center gap-4">
                  <Skeleton width="2.5rem" height="2.5rem" rounded="lg" />
                  <div className="flex-1">
                    <Skeleton height="0.875rem" width="40%" rounded="lg" />
                    <Skeleton height="0.75rem" width="20%" rounded="lg" className="mt-2" />
                  </div>
                  <Skeleton height="0.875rem" width="4rem" rounded="lg" />
                  <Skeleton height="0.875rem" width="3rem" rounded="lg" />
                  <Skeleton height="1.5rem" width="4rem" rounded="full" />
                </div>
              ))}
            </div>
          </div>
          {/* Mobile skeleton */}
          <div className="lg:hidden space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
                <div className="flex items-start gap-3">
                  <Skeleton width="3rem" height="3rem" rounded="lg" />
                  <div className="flex-1 min-w-0">
                    <Skeleton height="0.875rem" width="70%" rounded="lg" />
                    <Skeleton height="0.75rem" width="40%" rounded="lg" className="mt-2" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Skeleton height="0.75rem" width="4rem" rounded="lg" />
                  <Skeleton height="0.75rem" width="3rem" rounded="lg" />
                  <Skeleton height="1.5rem" width="4rem" rounded="full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ProductTable
          products={products}
          onToggleActive={handleToggleActive}
          onToggleDestacado={handleToggleDestacado}
          actionLoading={actionLoading}
          onArchive={setArchiveTarget}
          trash={view === 'papelera'}
          onRestore={handleRestore}
          onDeletePermanent={setDeleteTarget}
        />
      )}

      {/* Pagination */}
      {!loading && (
        <ProductPagination
          page={page}
          totalPages={totalPages}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onPageChange={goToPage}
        />
      )}

      {archiveTarget && (
        <Modal
          open
          onClose={() => { if (!archiving) setArchiveTarget(null) }}
          title="Enviar a la papelera"
          size="sm"
          footer={
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                ref={autofocusRef}
                onClick={() => setArchiveTarget(null)}
                disabled={archiving}
                className="min-h-11 sm:min-h-0 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={archiving}
                className="min-h-11 sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Enviar a papelera
              </button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 dark:text-white/60">
            <strong className="text-gray-800 dark:text-white/80 break-words">{archiveTarget.titulo}</strong> dejará de verse en
            la tienda. Podés restaurarlo cuando quieras.
          </p>
        </Modal>
      )}

      {deleteTarget && (
        <DeleteProductDialog
          key={deleteTarget.id}
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); refreshAll() }}
        />
      )}
    </div>
  )
}
