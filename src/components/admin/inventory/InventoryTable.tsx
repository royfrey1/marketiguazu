import { Link } from 'react-router-dom'
import { Settings, History } from 'lucide-react'
import type { InventoryAdminRow } from '../../../services/inventory.service'
import InventoryStockBadge from './InventoryStockBadge'

interface InventoryTableProps {
  items: InventoryAdminRow[]
  onAdjust: (item: InventoryAdminRow) => void
  onShowMovements: (item: InventoryAdminRow) => void
}

export default function InventoryTable({ items, onAdjust, onShowMovements }: InventoryTableProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
        <p className="text-gray-500 dark:text-white/40">No se encontraron productos con inventario</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
      {/* Desktop: table header */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_70px_70px_70px_70px_90px_80px] gap-2 px-4 py-2.5 text-[11px] font-medium text-gray-400 dark:text-white/25 uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
        <span>Producto</span>
        <span className="text-center">Stock</span>
        <span className="text-center">Reservado</span>
        <span className="text-center">Disponible</span>
        <span className="text-center">Umbral</span>
        <span className="text-center">Estado</span>
        <span className="text-right">Acciones</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {items.map((item) => {
          const available = item.quantity - item.reserved

          return (
            <div
              key={item.id}
              className="px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
            >
              {/* Desktop: grid row */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_70px_70px_70px_70px_90px_80px] gap-2 sm:items-center">
                {/* Producto */}
                <div className="flex items-center gap-3 min-w-0">
                  {(item.variant_imagen_url || item.product_imagen_url) ? (
                    <img
                      src={item.variant_imagen_url || item.product_imagen_url || ''}
                      alt={item.variant_nombre || item.product_titulo}
                      className="w-9 h-9 rounded-lg object-cover bg-gray-100 dark:bg-white/5 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/20 text-xs shrink-0">
                      --
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link
                      to={`/admin/productos/${item.product_id}/editar`}
                      className="text-sm font-medium text-gray-800 dark:text-white/80 hover:text-[#185749] dark:hover:text-[#1CAAA8] truncate block transition-colors"
                    >
                      {item.product_titulo}
                    </Link>
                    <p className="text-xs text-gray-400 dark:text-white/30 truncate">
                      {item.variant_nombre
                        ? `${item.variant_nombre}${item.variant_sku ? ` · ${item.variant_sku}` : ''}`
                        : item.category_nombre || 'Sin categoría'
                      }
                    </p>
                  </div>
                </div>

                {/* Stock */}
                <span className="text-sm font-semibold text-gray-800 dark:text-white/80 text-center">{item.quantity}</span>

                {/* Reservado */}
                <span className={`text-sm font-medium text-center ${item.reserved > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-white/30'}`}>
                  {item.reserved}
                </span>

                {/* Disponible */}
                <span className={`text-sm font-semibold text-center ${available <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white/80'}`}>
                  {available}
                </span>

                {/* Umbral */}
                <span className="text-sm text-gray-500 dark:text-white/40 text-center">{item.low_stock_threshold}</span>

                {/* Estado */}
                <div className="flex justify-center">
                  <InventoryStockBadge
                    quantity={item.quantity}
                    reserved={item.reserved}
                    threshold={item.low_stock_threshold}
                  />
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-end gap-0.5">
                  <button
                    onClick={() => onAdjust(item)}
                    className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                    title="Ajustar stock"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onShowMovements(item)}
                    className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                    title="Historial"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mobile: card */}
              <div className="sm:hidden space-y-2">
                <div className="flex items-start gap-3">
                  {(item.variant_imagen_url || item.product_imagen_url) ? (
                    <img
                      src={item.variant_imagen_url || item.product_imagen_url || ''}
                      alt={item.variant_nombre || item.product_titulo}
                      className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-white/5 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/20 text-xs shrink-0">
                      --
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/admin/productos/${item.product_id}/editar`}
                      className="text-sm font-medium text-gray-800 dark:text-white/80 hover:text-[#185749] dark:hover:text-[#1CAAA8] truncate block transition-colors"
                    >
                      {item.product_titulo}
                    </Link>
                    <p className="text-xs text-gray-400 dark:text-white/30 truncate">
                      {item.variant_nombre
                        ? `${item.variant_nombre}${item.variant_sku ? ` · ${item.variant_sku}` : ''}`
                        : item.category_nombre || 'Sin categoría'
                      }
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-white/25 uppercase tracking-wider">Stock</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/80">{item.quantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-white/25 uppercase tracking-wider">Reservado</p>
                    <p className={`text-sm font-medium ${item.reserved > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-white/30'}`}>
                      {item.reserved}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-white/25 uppercase tracking-wider">Disponible</p>
                    <p className={`text-sm font-semibold ${available <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white/80'}`}>
                      {available}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <InventoryStockBadge
                    quantity={item.quantity}
                    reserved={item.reserved}
                    threshold={item.low_stock_threshold}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onAdjust(item)}
                      className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                      title="Ajustar stock"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onShowMovements(item)}
                      className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                      title="Historial"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
