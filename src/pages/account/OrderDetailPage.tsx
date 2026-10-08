import { useEffect, useState } from 'react'
import Seo from '../../components/seo/Seo'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle, RefreshCw, Package, Truck, MapPin, CreditCard,
  Calendar, ArrowLeft, ShoppingBag, FileText, Coins, RotateCcw, Landmark,
} from 'lucide-react'
import { useOrder } from '../../hooks/useOrder'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import { withdrawalService } from '../../services/withdrawal.service'
import { WITHDRAWAL_STATUS_MAP, isWithdrawalStatus, type WithdrawalRow } from '../../types/withdrawal'


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

const SHIPMENT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  processing: { label: 'Procesando', variant: 'info' },
  shipped: { label: 'Despachado', variant: 'info' },
  in_transit: { label: 'En tránsito', variant: 'info' },
  delivered: { label: 'Entregado', variant: 'success' },
  failed: { label: 'Fallido', variant: 'danger' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function ProviderLabel({ provider }: { provider: string }) {
  if (provider === 'mercadopago') return <span>Mercado Pago</span>
  if (provider === 'usdt') return <span>USDT (TRC20)</span>
  if (provider === 'transfer') return <span>Transferencia bancaria</span>
  return <span className="capitalize">{provider.replace(/_/g, ' ')}</span>
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({ icon: Icon, title, children }: {
  icon: typeof Package
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-primary-dark text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function AddressSection({ address }: { address: Record<string, string | undefined> | null }) {
  if (!address) return null
  const parts = [
    address.calle,
    address.numero,
    address.piso && `Piso ${address.piso}`,
    address.departamento && `Depto ${address.departamento}`,
  ].filter(Boolean)

  return (
    <SectionCard icon={MapPin} title="Dirección de envío">
      <div className="space-y-1 text-sm text-gray-600">
        {parts.length > 0 && <p>{parts.join(', ')}</p>}
        {address.ciudad && <p>{address.ciudad}{address.provincia ? `, ${address.provincia}` : ''}</p>}
        {address.codigo_postal && <p>CP {address.codigo_postal}</p>}
        {address.pais && <p className="capitalize">{address.pais}</p>}
        {address.telefono && <p className="text-gray-400 mt-2">Tel: {address.telefono}</p>}
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="store-container section-spacing">
        <Skeleton height="1rem" width="16rem" rounded="lg" className="mb-6" />
        <div className="mb-8 space-y-3">
          <Skeleton height="1.75rem" width="14rem" rounded="lg" />
          <Skeleton height="1rem" width="10rem" rounded="lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
              <Skeleton height="1rem" width="8rem" rounded="lg" />
              {[1, 2].map(n => (
                <div key={n} className="flex gap-4">
                  <Skeleton height="4rem" width="4rem" rounded="lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton height="1rem" width="12rem" rounded="lg" />
                    <Skeleton height="0.875rem" width="8rem" rounded="lg" />
                    <Skeleton height="0.875rem" width="6rem" rounded="lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex justify-between">
                  <Skeleton height="0.875rem" width="6rem" rounded="lg" />
                  <Skeleton height="0.875rem" width="4rem" rounded="lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function OrderDetailPageContent() {
  const { id } = useParams<{ id: string }>()
  const orderId = id ? Number(id) : NaN
  const isValidId = !isNaN(orderId) && orderId > 0

  const { data: order, loading, error, refetch } = useOrder(isValidId ? orderId : null)

  // Solicitud de arrepentimiento más reciente de este pedido (si hay)
  const [withdrawal, setWithdrawal] = useState<{ orderId: number; row: WithdrawalRow | null } | null>(null)
  useEffect(() => {
    if (!isValidId) return
    let cancelled = false
    withdrawalService.listMyWithdrawals(orderId).then(({ data }) => {
      if (!cancelled) setWithdrawal({ orderId, row: data[0] ?? null })
    })
    return () => { cancelled = true }
  }, [orderId, isValidId])

  // --- Invalid ID ---
  if (!isValidId) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="store-container section-spacing">
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-600 mb-2">Pedido no encontrado</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              El identificador del pedido no es válido.
            </p>
            <Link to="/pedidos" className="btn-primary-sm inline-block">
              Volver a mis pedidos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // --- Loading ---
  if (loading) return <LoadingSkeleton />

  // --- Error ---
  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="store-container section-spacing">
          <nav className="breadcrumb mb-6">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
            <span>/</span>
            <Link to="/pedidos" className="breadcrumb-link">Mis pedidos</Link>
          </nav>
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-700 mb-2">No se pudo cargar el pedido</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">{error}</p>
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // --- Not found ---
  if (!order) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="store-container section-spacing">
          <nav className="breadcrumb mb-6">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
            <span>/</span>
            <Link to="/pedidos" className="breadcrumb-link">Mis pedidos</Link>
          </nav>
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-600 mb-2">Pedido no encontrado</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              No pudimos encontrar este pedido. Puede que no exista o que no tengas acceso.
            </p>
            <Link to="/pedidos" className="btn-primary-sm inline-block">
              Volver a mis pedidos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // --- Data ---
  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
  const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }
  const address = order.direccion_envio as Record<string, string | undefined> | null
  const firstPayment = order.payments?.[0]
  const hasPendingUsdtPayment = order.payments?.some(p => p.provider === 'usdt' && p.status === 'pending') ?? false
  const hasPendingTransferPayment = order.payments?.some(p => p.provider === 'transfer' && p.status === 'pending') ?? false
  const firstShipment = order.shipments?.[0]
  const shipmentStatus = firstShipment
    ? SHIPMENT_STATUS_MAP[firstShipment.status] ?? { label: firstShipment.status, variant: 'default' as const }
    : null

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="store-container section-spacing">
        {/* Breadcrumb */}
        <nav className="breadcrumb mb-6">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <Link to="/pedidos" className="breadcrumb-link">Mis pedidos</Link>
          <span>/</span>
          <span className="breadcrumb-current">{order.numero_pedido}</span>
        </nav>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link
            to="/pedidos"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-accent transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a mis pedidos
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-h2 text-2xl sm:text-3xl">
                Pedido {order.numero_pedido}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(order.created_at)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <Badge variant={paymentInfo.variant}>Pago: {paymentInfo.label}</Badge>
            </div>
          </div>
        </motion.div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Products */}
            <SectionCard icon={ShoppingBag} title="Productos">
              <div className="divide-y divide-gray-100">
                {order.order_items.map(item => (
                  <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-primary-dark text-sm">{item.nombre_producto}</p>
                      {item.variante_nombre && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.variante_nombre}</p>
                      )}
                      {item.sku && (
                        <p className="text-[11px] text-gray-300 mt-0.5">SKU: {item.sku}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{formatCurrency(item.precio_unitario)} × {item.cantidad}</span>
                      </div>
                    </div>
                    <p className="font-bold text-primary-dark text-sm whitespace-nowrap">
                      {formatCurrency(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Shipping */}
            {order.metodo_envio && (
              <SectionCard icon={Truck} title="Envío">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Método</span>
                    <span className="font-medium text-primary-dark capitalize">
                      {order.metodo_envio.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {firstShipment && (
                    <>
                      {shipmentStatus && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Estado</span>
                          <Badge variant={shipmentStatus.variant}>{shipmentStatus.label}</Badge>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Proveedor</span>
                        <span className="font-medium text-primary-dark capitalize">
                          {firstShipment.provider.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {firstShipment.provider_tracking_id && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tracking</span>
                          <span className="font-mono text-xs text-primary-dark">
                            {firstShipment.provider_tracking_id}
                          </span>
                        </div>
                      )}
                      {firstShipment.estimated_days && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Estimado</span>
                          <span className="text-primary-dark">
                            {firstShipment.estimated_days} días hábiles
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Address */}
            <AddressSection address={address} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <SectionCard icon={FileText} title="Resumen de compra">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-primary-dark">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Envío</span>
                  <span className="text-primary-dark">
                    {order.envio_costo > 0 ? formatCurrency(order.envio_costo) : 'Gratis'}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="font-bold text-primary-dark">Total</span>
                  <span className="font-black text-lg text-primary-dark">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </SectionCard>

            {/* Payment */}
            <SectionCard icon={CreditCard} title="Pago">
              {firstPayment ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Estado</span>
                    <Badge variant={
                      PAYMENT_STATUS_MAP[firstPayment.status]?.variant ?? 'default'
                    }>
                      {PAYMENT_STATUS_MAP[firstPayment.status]?.label ?? firstPayment.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Método</span>
                    <span className="font-medium text-primary-dark">
                      <ProviderLabel provider={firstPayment.provider} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Monto</span>
                    <span className="font-medium text-primary-dark">
                      {formatCurrency(firstPayment.amount)} {firstPayment.currency}
                    </span>
                  </div>
                  {hasPendingUsdtPayment && (
                    <Link to={`/pago/usdt?order=${order.id}`} className="block pt-1">
                      <Button variant="primary" size="sm" className="w-full">
                        <Coins className="w-4 h-4" />
                        Ver datos de pago USDT
                      </Button>
                    </Link>
                  )}
                  {hasPendingTransferPayment && (
                    <Link to={`/pago/transferencia?order=${order.id}`} className="block pt-1">
                      <Button variant="primary" size="sm" className="w-full">
                        <Landmark className="w-4 h-4" />
                        Ver datos de pago por transferencia
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sin información de pago</p>
              )}
            </SectionCard>

            {/* Arrepentimiento: constancia si ya la pidió; si no, acceso secundario al botón */}
            {withdrawal?.orderId === order.id && withdrawal.row ? (
              <SectionCard icon={RotateCcw} title="Arrepentimiento">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-gray-500">Constancia</span>
                    <span className="font-bold text-primary-dark">{withdrawal.row.numero}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-gray-500">Estado</span>
                    <Badge variant={isWithdrawalStatus(withdrawal.row.status) ? WITHDRAWAL_STATUS_MAP[withdrawal.row.status].variant : 'default'}>
                      {isWithdrawalStatus(withdrawal.row.status) ? WITHDRAWAL_STATUS_MAP[withdrawal.row.status].label : withdrawal.row.status}
                    </Badge>
                  </div>
                </div>
              </SectionCard>
            ) : withdrawal?.orderId === order.id && order.payment_status === 'approved' && order.status !== 'cancelled' && (
              <Link
                to={`/arrepentimiento?pedido=${encodeURIComponent(order.numero_pedido)}`}
                className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Arrepentirme de la compra
              </Link>
            )}

            {/* Notes */}
            {order.notas && (
              <SectionCard icon={FileText} title="Notas">
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notas}</p>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// noindex en todos los estados (cargando, error, vacío), no solo en el render principal
export default function OrderDetailPage() {
  return (
    <>
      <Seo noindex title="Detalle del pedido" />
      <OrderDetailPageContent />
    </>
  )
}
