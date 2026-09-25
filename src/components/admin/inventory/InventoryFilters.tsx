import type { AdminInventoryFilters } from '../../../services/inventory.service'

interface InventoryFiltersProps {
  filters: AdminInventoryFilters
  onFiltersChange: (filters: AdminInventoryFilters) => void
  total: number
}

export default function InventoryFilters({ filters, onFiltersChange, total }: InventoryFiltersProps) {
  const hasFilters = filters.search || (filters.status && filters.status !== 'all') || (filters.sort && filters.sort !== 'product_asc')

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          className="flex-1 min-w-[200px] px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
        />

        <select
          value={filters.status || 'all'}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as AdminInventoryFilters['status'] })}
          className="px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
        >
          <option value="all">Todos</option>
          <option value="out_of_stock">Sin stock</option>
          <option value="low_stock">Stock bajo</option>
          <option value="in_stock">En stock</option>
        </select>

        <select
          value={filters.sort || 'product_asc'}
          onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value as AdminInventoryFilters['sort'] })}
          className="px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
        >
          <option value="product_asc">Producto A-Z</option>
          <option value="product_desc">Producto Z-A</option>
          <option value="stock_asc">Stock menor</option>
          <option value="stock_desc">Stock mayor</option>
          <option value="updated_desc">Recién modificado</option>
          <option value="updated_asc">Menos reciente</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => onFiltersChange({})}
            className="text-xs text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 cursor-pointer transition-colors"
          >
            Limpiar
          </button>
        )}

        <span className="text-xs text-gray-400 dark:text-white/30 ml-auto">
          {total} {total === 1 ? 'item' : 'items'}
        </span>
      </div>
    </div>
  )
}
