import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { AdminProductFilters, AdminSortOption } from '../../../services/products.service'

interface ProductFiltersProps {
  filters: AdminProductFilters
  onFiltersChange: (filters: AdminProductFilters) => void
  categories: { id: number; nombre: string; icono: string | null }[]
  total: number
}

const SORT_OPTIONS: { value: AdminSortOption; label: string }[] = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'name_asc', label: 'Nombre A-Z' },
  { value: 'name_desc', label: 'Nombre Z-A' },
  { value: 'price_asc', label: 'Precio menor' },
  { value: 'price_desc', label: 'Precio mayor' },
]

export default function ProductFilters({
  filters,
  onFiltersChange,
  categories,
  total,
}: ProductFiltersProps) {
  const update = (patch: AdminProductFilters) => {
    onFiltersChange({ ...filters, ...patch })
  }

  const hasActiveFilters = filters.search || filters.category_id || filters.activo !== undefined

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={filters.search || ''}
            onChange={(e) => update({ search: e.target.value || undefined })}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
          />
        </div>

        {/* Category */}
        <select
          value={filters.category_id || ''}
          onChange={(e) => update({ category_id: e.target.value ? Number(e.target.value) : undefined })}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icono} {cat.nombre}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.activo === undefined ? '' : String(filters.activo)}
          onChange={(e) => update({ activo: e.target.value === '' ? undefined : e.target.value === 'true' })}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>

        {/* Sort */}
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-white/30 pointer-events-none" />
          <select
            value={filters.sort || 'recent'}
            onChange={(e) => update({ sort: e.target.value as AdminSortOption })}
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={() => onFiltersChange({})}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Count */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
        <span className="text-xs text-gray-400 dark:text-white/30">
          {total} {total === 1 ? 'producto' : 'productos'}
          {hasActiveFilters && ' (filtrado)'}
        </span>
      </div>
    </div>
  )
}
