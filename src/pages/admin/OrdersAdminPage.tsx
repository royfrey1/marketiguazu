import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, AlertTriangle, RefreshCw, Eye, Package } from 'lucide-react'
import { useAdminOrders } from '../../hooks/useAdminOrders'
import type { AdminOrderFilters } from '../../services/order.service'
import Badge from '../../components/ui/Badge'
import Skeleton from '../../components/ui/Skeleton'
import ProductPagination from '../../components/admin/products/ProductPagination'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  paid: { label: 'Pagado', variant: 'success' },
  preparing: { label: 'Preparando', variant: 'info' },
  shipped: { label: 'Enviado', variant: 'info' },
  delivered: { label: 'Entregado', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  approved: { label: 'Aprobado', variant: 'success' },
  rejected: { label: 'Rechazado', variant: 'danger' },
  refunded: { label: 'Reembolsado', variant: 'info' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OrderFilters({
  filters,
  onFiltersChange,
  onClear,
  total,
}: {
  filters: AdminOrderFilters
  onFiltersChange: (f: AdminOrderFilters) => void
  onClear: () => void
  total: number
}) {
  const hasActiveFilters = filters.search || (filters.status && filters.status !== 'all') || (filters.payment_status && filters.payment_status !== 'all')

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
          <input
            type="text"
            placeholder="Buscar por número de pedido..."
            value={filters.search || ''}
            onChange={e => onFiltersChange({ ...filters, search: e.target.value || undefined })}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
          />
        </div>

        <select
          value={filters.status || 'all'}
          onChange={e => onFiltersChange({ ...filters, status: e.target.value === 'all' ? undefined : e.target.value })}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
          <option value="preparing">Preparando</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregado</option>
          <option value="cancelled">Cancelado</option>
        </select>

        <select
          value={filters.payment_status || 'all'}
          onChange={e => onFiltersChange({ ...filters, payment_status: e.target.value === 'all' ? undefined : e.target.value })}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
        >
          <option value="all">Todos los pagos</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobado</option>
          <option value="rejected">Rechazado</option>
          <option value="refunded">Reembolsado</option>
          <option value="cancelled">Cancelado</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
        <span className="text-xs text-gray-400 dark:text-white/30">
          {total} {total === 1 ? 'pedido' : 'pedidos'}
          {hasActiveFilters && ' (filtrado)'}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton height="3rem" rounded="xl" />
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="flex gap-4">
              <Skeleton height="1rem" width="6rem" rounded="lg" />
              <Skeleton height="1rem" width="8rem" rounded="lg" />
              <Skeleton height="1rem" width="5rem" rounded="lg" className="hidden sm:block" />
              <Skeleton height="1rem" width="4rem" rounded="lg" />
              <Skeleton height="1rem" width="3rem" rounded="lg" className="hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OrdersAdminPage() {
  const [filters, setFilters] = useState<AdminOrderFilters>({})

  const {
    data: orders,
    total,
    page,
    loading,
    error,
    totalPages,
    hasNext,
    hasPrev,
    goToPage,
    refetch,
  } = useAdminOrders({ filters, pageSize: 20 })

  const handleClearFilters = () => {
    setFilters({})
    goToPage(1)
  }

  // --- Loading ---
  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">Cargando...</p>
        </div>
        <div className="mt-6">
          <LoadingSkeleton />
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">Gestión y seguimiento de pedidos del marketplace.</p>
        </div>
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-700 dark:text-white/80 mb-1">No se pudieron cargar los pedidos</h3>
          <p className="text-sm text-gray-400 dark:text-white/40 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749] dark:border-[#1CAAA8]/30 rounded-lg hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
            {total} {total === 1 ? 'pedido' : 'pedidos'}
          </p>
        </div>
        <button
          onClick={refetch}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-[#1CAAA8]/30 bg-[#1CAAA8]/10 text-[#1CAAA8] hover:bg-[#1CAAA8]/20 dark:border-[#1CAAA8]/30 dark:bg-[#1CAAA8]/10 dark:text-[#1CAAA8] dark:hover:bg-[#1CAAA8]/20 transition-colors cursor-pointer"
          title="Actualizar pedidos"
          aria-label="Actualizar pedidos"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button
              onClick={refetch}
              className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 cursor-pointer shrink-0"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <OrderFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClear={handleClearFilters}
        total={total}
      />

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
          <Package className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-600 dark:text-white/50 mb-1">
            {total === 0 ? 'No hay pedidos para mostrar' : 'No se encontraron resultados'}
          </h3>
          <p className="text-sm text-gray-400 dark:text-white/25">
            {total === 0
              ? 'Cuando se realicen pedidos, aparecerán aquí.'
              : 'Intenta ajustar los filtros de búsqueda.'}
          </p>
        </div>
      )}

      {/* Orders content */}
      {orders.length > 0 && (
        <>
          {/* Desktop table (>=1024px) */}
          <div className="hidden lg:block bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5">
                  <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Pedido</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Comprador</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Pago</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Envío</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-400 dark:text-white/30">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-400 dark:text-white/30 w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {orders.map(order => {
                  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
                  const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#185749] dark:text-[#1CAAA8]">
                        #{order.numero_pedido}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-white/50">
                        {order.buyer_nombre || <span className="text-gray-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/40">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/40 capitalize">
                        {order.metodo_envio?.replace(/_/g, ' ') || <span className="text-gray-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-white/80">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/pedido/${order.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749]/20 dark:border-[#1CAAA8]/20 rounded-lg hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver pedido
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Tablet table (768-1023px) */}
          <div className="hidden md:block lg:hidden bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5">
                  <th className="text-left px-3 py-2 font-medium text-gray-400 dark:text-white/30">Pedido</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400 dark:text-white/30">Comprador</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400 dark:text-white/30">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400 dark:text-white/30">Estado</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400 dark:text-white/30">Pago</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-400 dark:text-white/30">Total</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-400 dark:text-white/30 w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {orders.map(order => {
                  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
                  const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 font-bold text-[#185749] dark:text-[#1CAAA8]">
                        #{order.numero_pedido}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-white/50 truncate max-w-[120px]">
                        {order.buyer_nombre || <span className="text-gray-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-white/40">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusInfo.variant} className="text-[9px] px-1.5">{statusInfo.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={paymentInfo.variant} className="text-[9px] px-1.5">{paymentInfo.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-800 dark:text-white/80">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          to={`/admin/pedido/${order.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749]/20 dark:border-[#1CAAA8]/20 rounded-lg hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards (<768px) */}
          <div className="md:hidden space-y-3">
            {orders.map(order => {
              const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
              const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }

              return (
                <div key={order.id} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-[#185749] dark:text-[#1CAAA8]">#{order.numero_pedido}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <p className="font-black text-gray-800 dark:text-white/80">{formatCurrency(order.total)}</p>
                  </div>

                  {order.buyer_nombre && (
                    <p className="text-sm text-gray-600 dark:text-white/50 mb-2">{order.buyer_nombre}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                    {order.metodo_envio && (
                      <span className="text-xs text-gray-400 dark:text-white/30 capitalize">{order.metodo_envio.replace(/_/g, ' ')}</span>
                    )}
                  </div>

                  <Link
                    to={`/admin/pedido/${order.id}`}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749]/20 dark:border-[#1CAAA8]/20 rounded-lg hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver pedido
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Loading overlay for refetch */}
          {loading && (
            <div className="text-center py-4">
              <RefreshCw className="w-5 h-5 text-gray-400 dark:text-white/30 animate-spin mx-auto" />
            </div>
          )}

          {/* Pagination */}
          <ProductPagination
            page={page}
            totalPages={totalPages}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  )
}
