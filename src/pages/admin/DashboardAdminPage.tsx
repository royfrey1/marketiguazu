import { useState, useEffect, useCallback, startTransition } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart, Package, AlertTriangle, TrendingUp,
  ArrowRight, Clock, Eye,
} from 'lucide-react'
import { orderService, type OrderAdminListItem } from '../../services/order.service'
import { productsService } from '../../services/products.service'
import { inventoryService } from '../../services/inventory.service'
import Badge from '../../components/ui/Badge'
import Skeleton from '../../components/ui/Skeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  totalOrders: number
  pendingOrders: number
  paidOrders: number
  preparingOrders: number
  shippedOrders: number
  deliveredOrders: number
  cancelledOrders: number
  totalProducts: number
  activeProducts: number
  inactiveProducts: number
  lowStockCount: number
  lowStockItems: { product_titulo: string }[]
  recentDelivered: OrderAdminListItem[]
  recentOrders: OrderAdminListItem[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ---------------------------------------------------------------------------
// KPI Card (navigable)
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  to,
  secondary,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  to: string
  secondary?: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={`
        group rounded-xl border p-5 block transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-[#185749]/20
        bg-white border-gray-200 hover:border-[#185749]/30 hover:shadow-[0_2px_12px_rgba(24,87,73,0.08)]
        dark:bg-[#162420] dark:border-white/5 dark:hover:border-[#1CAAA8]/30 dark:focus:ring-[#1CAAA8]/20
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-white/40 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${color} group-hover:brightness-110`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">{value}</p>
      {secondary && (
        <div className="mt-2 text-xs text-gray-500 dark:text-white/40 leading-relaxed">
          {secondary}
        </div>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const ORDER_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
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
// Main component
// ---------------------------------------------------------------------------

export default function DashboardAdminPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordersResult, productsData, inventoryResult] = await Promise.all([
        orderService.getAllAdmin(1, 100),
        productsService.getAllAdmin({ page: 1, pageSize: 1 }),
        inventoryService.getAllAdmin({ status: 'low_stock' }),
      ])

      const allOrders = ordersResult.data
      const totalOrders = ordersResult.total

      const statusCounts = allOrders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const lowStockItems = inventoryResult.data ?? []
      const lowStockFiltered = lowStockItems.filter(
        item => item.quantity <= (item.low_stock_threshold ?? 5)
      )

      const deliveredOrders = allOrders.filter(o => o.status === 'delivered')

      setData({
        totalOrders,
        pendingOrders: statusCounts['pending'] ?? 0,
        paidOrders: statusCounts['paid'] ?? 0,
        preparingOrders: statusCounts['preparing'] ?? 0,
        shippedOrders: statusCounts['shipped'] ?? 0,
        deliveredOrders: deliveredOrders.length,
        cancelledOrders: statusCounts['cancelled'] ?? 0,
        totalProducts: productsData.total,
        activeProducts: productsData.data?.filter(p => p.activo)?.length ?? 0,
        inactiveProducts: productsData.data?.filter(p => !p.activo)?.length ?? 0,
        lowStockCount: lowStockFiltered.length,
        lowStockItems: lowStockFiltered.slice(0, 3).map(i => ({ product_titulo: i.product_titulo })),
        recentDelivered: deliveredOrders.slice(0, 2),
        recentOrders: allOrders.slice(0, 5),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => { loadDashboard() })
  }, [loadDashboard])

  // --- Loading ---
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton height="1.75rem" width="12rem" rounded="lg" />
          <Skeleton height="0.875rem" width="20rem" rounded="lg" className="mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-5">
              <Skeleton height="0.75rem" width="5rem" rounded="lg" />
              <Skeleton height="1.75rem" width="4rem" rounded="lg" className="mt-3" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
            <Skeleton height="1rem" width="8rem" rounded="lg" />
            <Skeleton height="10rem" rounded="lg" className="mt-4" />
          </div>
          <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
            <Skeleton height="1rem" width="8rem" rounded="lg" />
            <Skeleton height="10rem" rounded="lg" className="mt-4" />
          </div>
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error) {
    return (
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-700 dark:text-white/80 mb-1">No se pudo cargar el dashboard</h3>
        <p className="text-sm text-gray-400 dark:text-white/30 mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="text-sm font-medium text-[#185749] hover:underline cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) return null

  const hasOrders = data.totalOrders > 0
  const pendingAlerts = data.pendingOrders + data.paidOrders

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Resumen general de la tienda</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Pedidos"
          value={data.totalOrders}
          icon={ShoppingCart}
          color="bg-[#185749]/10 text-[#185749]"
          to="/admin/pedidos"
          secondary={
            data.totalOrders > 0 ? (
              <span>
                {data.pendingOrders > 0 && <>{data.pendingOrders} pendiente{data.pendingOrders !== 1 && 's'}</>}
                {data.pendingOrders > 0 && data.preparingOrders > 0 && <>, </>}
                {data.preparingOrders > 0 && <>{data.preparingOrders} en preparación</>}
                {data.pendingOrders === 0 && data.preparingOrders === 0 && <>{data.totalOrders} totales</>}
              </span>
            ) : (
              <span>Sin pedidos</span>
            )
          }
        />
        <KpiCard
          label="Productos"
          value={data.totalProducts}
          icon={Package}
          color="bg-[#1CAAA8]/10 text-[#1CAAA8]"
          to="/admin/productos"
          secondary={
            data.totalProducts > 0 ? (
              <span>
                {data.activeProducts} activo{data.activeProducts !== 1 && 's'}
                {data.inactiveProducts > 0 && <>, {data.inactiveProducts} inactivo{data.inactiveProducts !== 1 && 's'}</>}
              </span>
            ) : (
              <span>Sin productos</span>
            )
          }
        />
        <KpiCard
          label="Stock bajo"
          value={data.lowStockCount}
          icon={AlertTriangle}
          color="bg-amber-100 text-amber-600"
          to="/admin/inventario"
          secondary={
            data.lowStockCount > 0 ? (
              <span className="space-y-0.5">
                {data.lowStockItems.map((item, i) => (
                  <span key={i} className="block truncate">• {item.product_titulo}</span>
                ))}
                {data.lowStockCount > 3 && (
                  <span className="block">+ {data.lowStockCount - 3} más</span>
                )}
              </span>
            ) : (
              <span>Sin stock bajo</span>
            )
          }
        />
        <KpiCard
          label="Entregados"
          value={data.deliveredOrders}
          icon={TrendingUp}
          color="bg-emerald-100 text-emerald-600"
          to="/admin/pedidos"
          secondary={
            data.deliveredOrders > 0 ? (
              <span>
                {data.recentDelivered.length > 0 && (
                  <>
                    Último: #{data.recentDelivered[0].numero_pedido}
                    {data.deliveredOrders > 1 && <>, +{data.deliveredOrders - 1} más</>}
                  </>
                )}
              </span>
            ) : (
              <span>Sin entregados</span>
            )
          }
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column: Recent orders */}
        <div className="lg:col-span-2 bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
            <h2 className="font-bold text-gray-800 dark:text-white/80 text-sm">Pedidos recientes</h2>
            <Link
              to="/admin/pedidos"
              className="text-xs font-medium text-[#185749] hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.recentOrders.length > 0 ? (
            <>
              {/* Desktop/tablet: table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/5">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Pedido</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Cliente</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Pago</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Total</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {data.recentOrders.map(order => {
                      const statusInfo = ORDER_STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
                      const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }
                      return (
                        <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-3">
                            <span className="font-bold text-gray-800 dark:text-white/80">#{order.numero_pedido}</span>
                          </td>
                          <td className="px-6 py-3 text-gray-600 dark:text-white/50 truncate max-w-[120px]">
                            {order.buyer_nombre || <span className="text-gray-300 dark:text-white/20">—</span>}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-gray-800 dark:text-white/80">
                            {formatCurrency(order.total)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Link
                              to={`/admin/pedido/${order.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#185749] dark:text-[#1CAAA8] hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: compact cards */}
              <div className="lg:hidden divide-y divide-gray-100 dark:divide-white/5">
                {data.recentOrders.map(order => {
                  const statusInfo = ORDER_STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
                  const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }
                  return (
                    <div key={order.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-800 dark:text-white/80 text-sm">#{order.numero_pedido}</span>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-3">
                        <span className="text-gray-500 dark:text-white/40 truncate max-w-[60%]">
                          {order.buyer_nombre || <span className="text-gray-300 dark:text-white/20">—</span>}
                        </span>
                        <span className="font-bold text-gray-800 dark:text-white/80 ml-2 flex-shrink-0">{formatCurrency(order.total)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                        <Link
                          to={`/admin/pedido/${order.id}`}
                          className="text-xs font-medium text-[#185749] dark:text-[#1CAAA8] hover:underline"
                        >
                          Ver pedido
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="px-6 py-12 text-center">
              <Clock className="w-8 h-8 text-gray-200 dark:text-white/10 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-white/30">Todavía no hay pedidos.</p>
            </div>
          )}
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Orders by status */}
          <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
            <h2 className="font-bold text-gray-800 dark:text-white/80 text-sm mb-4">Pedidos por estado</h2>
            {hasOrders ? (
              <div className="space-y-3">
                {[
                  { key: 'pending', label: 'Pendientes', count: data.pendingOrders },
                  { key: 'paid', label: 'Pagados', count: data.paidOrders },
                  { key: 'preparing', label: 'Preparando', count: data.preparingOrders },
                  { key: 'shipped', label: 'Enviados', count: data.shippedOrders },
                  { key: 'delivered', label: 'Entregados', count: data.deliveredOrders },
                  { key: 'cancelled', label: 'Cancelados', count: data.cancelledOrders },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-white/50">{item.label}</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-white/80">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-white/30">Sin datos de pedidos.</p>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
            <h2 className="font-bold text-gray-800 dark:text-white/80 text-sm mb-4">Alertas operativas</h2>
            <div className="space-y-3">
              {pendingAlerts > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <ShoppingCart className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      {data.pendingOrders} {data.pendingOrders === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
                    </p>
                    <p className="text-[11px] text-amber-600">Requieren atención</p>
                  </div>
                </div>
              )}
              {data.paidOrders > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-800">
                      {data.paidOrders} {data.paidOrders === 1 ? 'pedido pagado' : 'pedidos pagados'}
                    </p>
                    <p className="text-[11px] text-blue-600">Listos para preparar</p>
                  </div>
                </div>
              )}
              {data.lowStockCount > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-800">
                      {data.lowStockCount} {data.lowStockCount === 1 ? 'producto con stock bajo' : 'productos con stock bajo'}
                    </p>
                    <p className="text-[11px] text-red-600">Revisar inventario</p>
                  </div>
                </div>
              )}
              {pendingAlerts === 0 && data.lowStockCount === 0 && (
                <p className="text-sm text-gray-400 dark:text-white/30">Todo en orden. No hay alertas pendientes.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
