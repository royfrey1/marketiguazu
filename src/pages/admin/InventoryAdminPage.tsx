import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  inventoryService,
  type InventoryAdminRow,
  type AdminInventoryFilters,
} from '../../services/inventory.service'
import InventoryFilters from '../../components/admin/inventory/InventoryFilters'
import InventoryTable from '../../components/admin/inventory/InventoryTable'
import InventoryAdjustDialog from '../../components/admin/inventory/InventoryAdjustDialog'
import InventoryMovementDialog from '../../components/admin/inventory/InventoryMovementDialog'

const PAGE_SIZE = 20

export default function InventoryAdminPage() {
  const [items, setItems] = useState<InventoryAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AdminInventoryFilters>({})

  const [adjustItem, setAdjustItem] = useState<InventoryAdminRow | null>(null)
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [movementItem, setMovementItem] = useState<InventoryAdminRow | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      const { data, error: fetchError, count } = await inventoryService.getAllAdmin(filters)
      if (!cancelled) {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setItems(data || [])
          setTotal(count || 0)
        }
        setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [filters, refreshKey])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleAdjust = useCallback(async (quantity: number, tipo: 'restock' | 'adjustment' | 'return', notas: string) => {
    if (!adjustItem) return
    setAdjustLoading(true)
    try {
      const { error } = await inventoryService.adjustStock(adjustItem.id, quantity, tipo, notas)
      if (error) throw error
      setAdjustItem(null)
      setRefreshKey((k) => k + 1)
    } finally {
      setAdjustLoading(false)
    }
  }, [adjustItem])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Inventario</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
            {total} {total === 1 ? 'item' : 'items'} en inventario
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="p-2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          title="Recargar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
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

      {/* Filters */}
      <InventoryFilters
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1) }}
        total={total}
      />

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
          <p className="text-gray-400 dark:text-white/30 animate-pulse">Cargando inventario...</p>
        </div>
      ) : (
        <InventoryTable
          items={pagedItems}
          onAdjust={setAdjustItem}
          onShowMovements={setMovementItem}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500 dark:text-white/40">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Dialogs */}
      {adjustItem && (
        <InventoryAdjustDialog
          inventory={adjustItem}
          onConfirm={handleAdjust}
          onClose={() => setAdjustItem(null)}
          loading={adjustLoading}
        />
      )}

      {movementItem && (
        <InventoryMovementDialog
          inventoryId={movementItem.id}
          productTitle={movementItem.product_titulo}
          onClose={() => setMovementItem(null)}
        />
      )}
    </div>
  )
}
