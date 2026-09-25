import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useAdminProducts, useActiveCategories } from '../../hooks/useAdminProducts'
import { productsService, type ProductAdminRow, type AdminProductFilters } from '../../services/products.service'
import ProductFilters from '../../components/admin/products/ProductFilters'
import ProductTable from '../../components/admin/products/ProductTable'
import ProductPagination from '../../components/admin/products/ProductPagination'
import Skeleton from '../../components/ui/Skeleton'

export default function ProductsAdminPage() {
  const [filters, setFilters] = useState<AdminProductFilters>({})
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
  } = useAdminProducts({ filters })
  const { categories } = useActiveCategories()
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
            onClick={() => refetch()}
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

      {/* Filters */}
      <ProductFilters
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
        total={total}
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
    </div>
  )
}
