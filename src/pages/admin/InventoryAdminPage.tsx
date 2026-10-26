import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Boxes, CheckCircle2, History, RefreshCw, RotateCcw, X } from 'lucide-react'
import { sileo } from 'sileo'
import {
  inventoryService,
  type InventoryAdminRow,
  type AdminInventoryFilters,
} from '../../services/inventory.service'
import { stockChangeService } from '../../services/stockChange.service'
import { useRowSelection } from '../../hooks/useRowSelection'
import { stockRowDetail, type StockSelectedItem } from '../../lib/stockChange'
import InventoryFilters from '../../components/admin/inventory/InventoryFilters'
import InventoryTable from '../../components/admin/inventory/InventoryTable'
import InventoryAdjustDialog from '../../components/admin/inventory/InventoryAdjustDialog'
import InventoryMovementDialog from '../../components/admin/inventory/InventoryMovementDialog'
import BulkStockChangeDialog, { type StockChangeApplied } from '../../components/admin/inventory/BulkStockChangeDialog'
import RecentStockChangesDialog from '../../components/admin/inventory/RecentStockChangesDialog'
import UndoStockChangeDialog from '../../components/admin/inventory/UndoStockChangeDialog'
import type { UndoOutcome } from '../../components/admin/products/UndoPriceChangeDialog'
import BulkActionBar from '../../components/admin/BulkActionBar'
import FriendlyError from '../../components/admin/FriendlyError'

const PAGE_SIZE = 20

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es-AR')} ${n === 1 ? one : many}`

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

  // Selección de filas: se vacía al cambiar búsqueda, estado u orden; sigue al paginar
  const selectionKey = JSON.stringify(filters)
  const selection = useRowSelection<number>(selectionKey)
  const selectionKeyRef = useRef(selectionKey)
  // Nombre conocido por id: las filas elegidas de otras páginas (o que ya no vuelven) se nombran igual
  const knownRef = useRef(new Map<number, Omit<StockSelectedItem, 'id'>>())
  const [selectingAll, setSelectingAll] = useState(false)
  const [stockItems, setStockItems] = useState<StockSelectedItem[] | null>(null)
  // Último cambio masivo de stock aplicado: aviso con Deshacer (en el flujo de la página, no fijo)
  const [stockNotice, setStockNotice] = useState<StockChangeApplied | null>(null)
  // Lote que se está deshaciendo desde el aviso (aparte del aviso: el resultado se ve aunque el aviso se oculte)
  const [noticeUndoBatch, setNoticeUndoBatch] = useState<string | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)

  useEffect(() => {
    selectionKeyRef.current = selectionKey
  }, [selectionKey])

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

  useEffect(() => {
    for (const item of items) knownRef.current.set(item.id, { titulo: item.product_titulo, variante: stockRowDetail(item) })
  }, [items])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const pagedItems = useMemo(() => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [items, page])
  const visibleIds = useMemo(() => pagedItems.map(item => item.id), [pagedItems])
  const pageSelectionState = selection.stateOf(visibleIds)
  const hasFilters = !!(filters.search || (filters.status && filters.status !== 'all'))

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

  /** "Seleccionar las N filas": trae los ids de todas las filas que cumplen los filtros actuales */
  const selectAllFiltered = async () => {
    if (selectingAll) return
    const key = selectionKey
    setSelectingAll(true)
    const { data, error: idsError } = await stockChangeService.getInventoryIds(filters)
    setSelectingAll(false)
    // Si mientras tanto cambió el filtro, no se aplica
    if (selectionKeyRef.current !== key) return
    if (idsError) {
      sileo.error({ title: 'No se pudieron seleccionar todas las filas', description: <FriendlyError error={idsError} /> })
      return
    }
    selection.selectAll(data)
  }

  const openStockChange = () => {
    if (stockItems || selection.count === 0) return
    setStockItems([...selection.selected].map(id => {
      const known = knownRef.current.get(id)
      return { id, titulo: known?.titulo ?? 'Fila no disponible', variante: known?.variante ?? null }
    }))
  }

  const handleStockApplied = (result: StockChangeApplied) => {
    setStockItems(null)
    setStockNotice(result)
    selection.clear()
    setRefreshKey(k => k + 1)
  }

  /** Resultado de un Deshacer (desde el aviso o desde Cambios recientes) */
  const handleUndoOutcome = (batchId: string, outcome: UndoOutcome) => {
    if (outcome === 'restored' || outcome === 'already') {
      setStockNotice(current => (current?.batchId === batchId ? null : current))
    }
    if (outcome === 'restored') {
      selection.clear()
      setRefreshKey(k => k + 1)
    }
  }

  return (
    <div className="relative">
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

      {/* Aviso del último cambio masivo de stock (con Deshacer); la región queda montada para anunciarlo */}
      <div aria-live="polite">
        {stockNotice && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
            <p className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-200 min-w-0">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{stockNotice.rows === 1 ? 'Se cambió el stock de 1 fila.' : `Se cambió el stock de ${plural(stockNotice.rows, 'fila', 'filas')}.`}</span>
            </p>
            <div className="flex gap-2 sm:ml-auto shrink-0">
              <button
                type="button"
                onClick={() => setNoticeUndoBatch(stockNotice.batchId)}
                className="inline-flex items-center justify-center gap-1.5 min-h-tap sm:min-h-9 px-3 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] bg-white dark:bg-transparent border border-[#185749]/30 dark:border-[#1CAAA8]/30 hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/10 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Deshacer
              </button>
              <button
                type="button"
                onClick={() => setStockNotice(null)}
                className="inline-flex items-center justify-center gap-1 min-h-tap sm:min-h-9 px-3 text-sm text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                Cerrar
              </button>
            </div>
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

      {/* Filters */}
      <InventoryFilters
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1) }}
        total={total}
        actions={
          <button
            type="button"
            onClick={() => setRecentOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-tap sm:min-h-10 px-3 text-sm font-medium text-gray-600 dark:text-white/60 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <History className="w-4 h-4" aria-hidden="true" />
            Cambios recientes
          </button>
        }
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
          selection={{
            isSelected: selection.isSelected,
            toggle: (id, shiftKey) => selection.toggle(id, { shiftKey, orderedIds: visibleIds }),
            headerState: pageSelectionState,
            toggleAll: () => selection.toggleMany(visibleIds),
            disabled: !!stockItems,
          }}
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

      {stockItems && (
        <BulkStockChangeDialog
          items={stockItems}
          onClose={() => setStockItems(null)}
          onApplied={handleStockApplied}
          onOpenRecent={() => setRecentOpen(true)}
        />
      )}
      {recentOpen && (
        <RecentStockChangesDialog onClose={() => setRecentOpen(false)} onUndone={handleUndoOutcome} />
      )}
      {noticeUndoBatch && (
        <UndoStockChangeDialog
          batchId={noticeUndoBatch}
          onClose={() => setNoticeUndoBatch(null)}
          onFinished={outcome => handleUndoOutcome(noticeUndoBatch, outcome)}
        />
      )}
    </div>

      {/* Acciones masivas: sticky abajo, dentro del <main> que scrollea */}
      <BulkActionBar
        count={selection.count}
        countLabel={n => `${n.toLocaleString('es-AR')} ${n === 1 ? 'fila seleccionada' : 'filas seleccionadas'}`}
        onClear={selection.clear}
        busy={!!stockItems}
        selectAll={totalPages > 1 && pageSelectionState === 'all' && selection.count < total ? {
          label: hasFilters
            ? `Seleccionar las ${total.toLocaleString('es-AR')} filas filtradas`
            : `Seleccionar las ${total.toLocaleString('es-AR')} filas`,
          shortLabel: `Todas (${total.toLocaleString('es-AR')})`,
          onSelect: () => void selectAllFiltered(),
          loading: selectingAll,
        } : undefined}
      >
        <button
          type="button"
          onClick={openStockChange}
          disabled={!!stockItems}
          className="inline-flex items-center justify-center gap-1.5 min-h-tap lg:min-h-9 px-3 text-sm font-medium text-white bg-[#185749] hover:bg-[#0D3732] border border-[#185749] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 dark:border-[#1CAAA8] rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <Boxes className="w-4 h-4" aria-hidden="true" />
          Cambiar stock
        </button>
      </BulkActionBar>
    </div>
  )
}
