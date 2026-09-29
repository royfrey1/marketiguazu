import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, RefreshCw, Package, Truck, MapPin,
  CreditCard, ShoppingBag, FileText, User, Hash,
  ChevronRight, XCircle, Plus, Edit,
} from 'lucide-react'
import AdminSubpageHeader from '../../components/admin/AdminSubpageHeader'
import { supabase } from '../../lib/supabase/client'
import { useAdminOrder } from '../../hooks/useAdminOrder'
import { useAdminOrderMutations } from '../../hooks/useAdminOrderMutations'
import {
  type OrderStatus,
  type PaymentStatus,
  type ShipmentStatus,
  type ShipmentProvider,
} from '../../services/order.service'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'

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
// Status transitions
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS: Record<string, { next: OrderStatus; label: string }> = {
  pending: { next: 'paid', label: 'Marcar como pagado' },
  paid: { next: 'preparing', label: 'Pasar a preparación' },
  preparing: { next: 'shipped', label: 'Marcar como enviado' },
  shipped: { next: 'delivered', label: 'Marcar como entregado' },
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

// ---------------------------------------------------------------------------
// Payment transitions
// ---------------------------------------------------------------------------

const PAYMENT_TRANSITIONS: Record<string, { next: PaymentStatus; label: string }[]> = {
  pending: [
    { next: 'approved', label: 'Aprobar pago' },
    { next: 'rejected', label: 'Rechazar pago' },
    { next: 'cancelled', label: 'Cancelar pago' },
  ],
  approved: [
    { next: 'refunded', label: 'Marcar como reembolsado' },
  ],
  rejected: [
    { next: 'cancelled', label: 'Cancelar pago' },
  ],
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
}

// ---------------------------------------------------------------------------
// Shipment transitions
// ---------------------------------------------------------------------------

const SHIPMENT_TRANSITIONS: Record<string, { next: ShipmentStatus; label: string }[]> = {
  pending: [{ next: 'processing', label: 'Procesar' }],
  processing: [
    { next: 'shipped', label: 'Despachar' },
    { next: 'failed', label: 'Marcar fallido' },
  ],
  shipped: [
    { next: 'in_transit', label: 'En tránsito' },
    { next: 'failed', label: 'Marcar fallido' },
  ],
  in_transit: [
    { next: 'delivered', label: 'Marcar entregado' },
    { next: 'failed', label: 'Marcar fallido' },
  ],
}

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  shipped: 'Despachado',
  in_transit: 'En tránsito',
  delivered: 'Entregado',
  failed: 'Fallido',
}

const SHIPMENT_PROVIDERS: { value: ShipmentProvider; label: string }[] = [
  { value: 'correo_argentino', label: 'Correo Argentino' },
  { value: 'via_cargo', label: 'Via Cargo' },
  { value: 'crucero_express', label: 'Crucero Express' },
  { value: 'oca', label: 'OCA' },
  { value: 'otro', label: 'Otro' },
]

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
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton height="1rem" width="14rem" rounded="lg" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton height="1.75rem" width="16rem" rounded="lg" />
          <Skeleton height="1rem" width="10rem" rounded="lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton height="1.5rem" width="5rem" rounded="full" />
          <Skeleton height="1.5rem" width="6rem" rounded="full" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <Skeleton height="1rem" width="8rem" rounded="lg" />
            {[1, 2].map(n => (
              <div key={n} className="flex gap-4">
                <Skeleton height="3.5rem" width="3.5rem" rounded="lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton height="0.875rem" width="12rem" rounded="lg" />
                  <Skeleton height="0.75rem" width="8rem" rounded="lg" />
                </div>
                <Skeleton height="0.875rem" width="5rem" rounded="lg" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <Skeleton height="1rem" width="8rem" rounded="lg" />
            {[1, 2, 3].map(n => (
              <div key={n} className="flex justify-between">
                <Skeleton height="0.875rem" width="6rem" rounded="lg" />
                <Skeleton height="0.875rem" width="4rem" rounded="lg" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <Skeleton height="1rem" width="6rem" rounded="lg" />
            {[1, 2].map(n => (
              <div key={n} className="flex justify-between">
                <Skeleton height="0.875rem" width="5rem" rounded="lg" />
                <Skeleton height="0.875rem" width="4rem" rounded="lg" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <Skeleton height="1rem" width="8rem" rounded="lg" />
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
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const orderId = id ? Number(id) : NaN
  const isValidId = !isNaN(orderId) && orderId > 0

  const { data: order, loading, error, refetch } = useAdminOrder(isValidId ? orderId : null)
  const {
    updateOrderStatus, updatePaymentStatus, cancelOrder,
    createShipment, updateShipment, updateShipmentStatus,
  } = useAdminOrderMutations()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<{ id: number; currentStatus: string } | null>(null)
  const [paymentActionTarget, setPaymentActionTarget] = useState<PaymentStatus | null>(null)
  const [paymentActionError, setPaymentActionError] = useState<string | null>(null)

  // --- Shipment: create ---
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState<{
    provider: ShipmentProvider
    tracking: string
    costo: string
    estimatedDays: string
  }>({ provider: 'correo_argentino', tracking: '', costo: '0', estimatedDays: '' })
  const [createError, setCreateError] = useState<string | null>(null)

  // --- Shipment: edit ---
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{
    provider: ShipmentProvider
    tracking: string
    costo: string
    estimatedDays: string
  }>({ provider: 'correo_argentino', tracking: '', costo: '0', estimatedDays: '' })
  const [editError, setEditError] = useState<string | null>(null)

  // --- Shipment: status change ---
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<{ id: number; currentStatus: string; nextStatus: ShipmentStatus } | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // --- Shipment handlers ---
  const canCreateShipment = order?.status === 'paid' || order?.status === 'preparing'

  const openCreateModal = useCallback(() => {
    setCreateForm({ provider: 'correo_argentino', tracking: '', costo: '0', estimatedDays: '' })
    setCreateError(null)
    setCreateModalOpen(true)
  }, [])

  const handleCreateShipment = useCallback(async () => {
    if (!order) return
    const costo = parseFloat(createForm.costo)
    if (isNaN(costo) || costo < 0) {
      setCreateError('El costo debe ser un número mayor o igual a 0')
      return
    }
    const estimatedDays = createForm.estimatedDays.trim() ? parseInt(createForm.estimatedDays, 10) : null
    if (estimatedDays !== null && (isNaN(estimatedDays) || estimatedDays <= 0)) {
      setCreateError('Los días estimados deben ser un número mayor a 0')
      return
    }

    setCreateError(null)
    const result = await createShipment.execute({
      orderId: order.id,
      provider: createForm.provider,
      costo,
      estimatedDays,
      providerTrackingId: createForm.tracking.trim() || null,
    })
    if (result.success) {
      setCreateModalOpen(false)
      await refetch()
    } else {
      setCreateError(result.error)
    }
  }, [order, createForm, createShipment, refetch])

  const openEditModal = useCallback((shipment: { id: number; provider: string; provider_tracking_id: string | null; costo: number; estimated_days: number | null }) => {
    setEditTarget(shipment.id)
    setEditForm({
      provider: shipment.provider as ShipmentProvider,
      tracking: shipment.provider_tracking_id ?? '',
      costo: String(shipment.costo),
      estimatedDays: shipment.estimated_days != null ? String(shipment.estimated_days) : '',
    })
    setEditError(null)
    setEditModalOpen(true)
  }, [])

  const handleEditShipment = useCallback(async () => {
    if (editTarget == null) return
    const costo = parseFloat(editForm.costo)
    if (isNaN(costo) || costo < 0) {
      setEditError('El costo debe ser un número mayor o igual a 0')
      return
    }
    const estimatedDays = editForm.estimatedDays.trim() ? parseInt(editForm.estimatedDays, 10) : null
    if (estimatedDays !== null && (isNaN(estimatedDays) || estimatedDays <= 0)) {
      setEditError('Los días estimados deben ser un número mayor a 0')
      return
    }

    setEditError(null)
    const result = await updateShipment.execute(editTarget, {
      provider: editForm.provider,
      costo,
      estimatedDays,
      providerTrackingId: editForm.tracking.trim() || null,
    })
    if (result.success) {
      setEditModalOpen(false)
      setEditTarget(null)
      await refetch()
    } else {
      setEditError(result.error)
    }
  }, [editTarget, editForm, updateShipment, refetch])

  const openStatusModal = useCallback((shipmentId: number, currentStatus: string, nextStatus: ShipmentStatus) => {
    setStatusTarget({ id: shipmentId, currentStatus, nextStatus })
    setStatusError(null)
    setStatusModalOpen(true)
  }, [])

  const handleStatusChange = useCallback(async () => {
    if (!statusTarget) return
    setStatusError(null)
    const result = await updateShipmentStatus.execute(statusTarget.id, statusTarget.nextStatus)
    if (result.success) {
      setStatusModalOpen(false)
      setStatusTarget(null)
      await refetch()
    } else {
      setStatusError(result.error)
    }
  }, [statusTarget, updateShipmentStatus, refetch])

  const handleStatusTransition = useCallback(async () => {
    if (!order) return
    const transition = STATUS_TRANSITIONS[order.status]
    if (!transition) return

    setActionError(null)
    const result = await updateOrderStatus.execute(order.id, transition.next)
    if (result.success) {
      setConfirmOpen(false)
      await refetch()
    } else {
      setActionError(result.error)
    }
  }, [order, updateOrderStatus, refetch])

  const openPaymentModal = useCallback((paymentId: number, currentStatus: string, targetStatus: PaymentStatus) => {
    setPaymentActionError(null)
    setSelectedPayment({ id: paymentId, currentStatus })
    setPaymentActionTarget(targetStatus)
    setPaymentModalOpen(true)
  }, [])

  const handlePaymentAction = useCallback(async () => {
    if (!selectedPayment || !paymentActionTarget) return

    setPaymentActionError(null)
    const result = await updatePaymentStatus.execute(selectedPayment.id, paymentActionTarget)
    if (result.success) {
      setPaymentModalOpen(false)
      setSelectedPayment(null)
      setPaymentActionTarget(null)
      await refetch()
    } else {
      setPaymentActionError(result.error)
    }
  }, [selectedPayment, paymentActionTarget, updatePaymentStatus, refetch])

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  // --- Manual payment verification (plan B while MP webhooks fail) ---
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleVerifyPayment = useCallback(async () => {
    if (!order) return
    setVerifyLoading(true)
    setVerifyResult(null)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setVerifyResult({ ok: false, message: 'Necesitás iniciar sesión.' })
        return
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const resp = await fetch(`${supabaseUrl}/functions/v1/admin-verify-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: order.id }),
      })
      const body = await resp.json().catch(() => null)
      if (!resp.ok || body?.success !== true) {
        const message = body?.error?.message ?? body?.message ?? 'No se pudo verificar el pago.'
        setVerifyResult({ ok: false, message })
      } else {
        setVerifyResult({ ok: true, message: body.message ?? 'Verificación completada.' })
        await refetch()
      }
    } catch {
      setVerifyResult({ ok: false, message: 'Error de red al verificar el pago.' })
    } finally {
      setVerifyLoading(false)
    }
  }, [order, refetch])

  const handleCancelOrder = useCallback(async () => {
    if (!order) return

    setCancelError(null)
    const result = await cancelOrder.execute(order.id, cancelReason || undefined)
    if (result.success) {
      setCancelModalOpen(false)
      setCancelReason('')
      await refetch()
    } else {
      setCancelError(result.error)
    }
  }, [order, cancelOrder, cancelReason, refetch])

  // --- Invalid ID ---
  if (!isValidId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Detalle de pedido</h1>
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">Pedido inválido</h3>
          <p className="text-sm text-gray-400 mb-4">El identificador del pedido no es válido.</p>
          <Link
            to="/admin/pedidos"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#185749] border border-[#185749] rounded-lg hover:bg-[#185749]/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a pedidos
          </Link>
        </div>
      </div>
    )
  }

  // --- Loading ---
  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Detalle de pedido</h1>
        <div className="mt-6">
          <LoadingSkeleton />
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Detalle de pedido</h1>
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">No se pudo cargar el pedido</h3>
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#185749] border border-[#185749] rounded-lg hover:bg-[#185749]/5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // --- Not found ---
  if (!order) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Detalle de pedido</h1>
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">Pedido no encontrado</h3>
          <p className="text-sm text-gray-400 mb-4">
            No se encontró un pedido con ese identificador.
          </p>
          <Link
            to="/admin/pedidos"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#185749] border border-[#185749] rounded-lg hover:bg-[#185749]/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a pedidos
          </Link>
        </div>
      </div>
    )
  }

  // --- Data ---
  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
  const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }
  const canVerifyPayment = order.payment_status === 'pending' && order.payments.length > 0
  const address = order.direccion_envio as Record<string, string | undefined> | null

  return (
    <div>
      {/* Header */}
      <AdminSubpageHeader
        title={`Pedido ${order.numero_pedido}`}
        description={formatDate(order.created_at)}
        backHref="/admin/pedidos"
        backLabel="Volver a pedidos"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin' },
          { label: 'Pedidos', href: '/admin/pedidos' },
          { label: `#${order.numero_pedido}` },
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          <Badge variant={paymentInfo.variant}>Pago: {paymentInfo.label}</Badge>
        </div>
      </AdminSubpageHeader>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="w-4 h-4 text-[#185749]" />
              <h3 className="font-bold text-gray-800 text-sm">Productos del pedido</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {order.order_items.map(item => (
                <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Hash className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">{item.nombre_producto}</p>
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
                  <p className="font-bold text-gray-800 text-sm whitespace-nowrap">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Envíos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#185749]" />
                <h3 className="font-bold text-gray-800 text-sm">
                  Envíos {(order.shipments?.length ?? 0) > 0 && (
                    <span className="text-gray-400 font-normal">({order.shipments.length})</span>
                  )}
                </h3>
              </div>
              {canCreateShipment && (
                <Button variant="primary" size="sm" onClick={openCreateModal}>
                  <Plus className="w-4 h-4" />
                  Crear envío
                </Button>
              )}
            </div>

            {(order.shipments?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {order.shipments.map(shipment => {
                  const shipmentStatusInfo = SHIPMENT_STATUS_MAP[shipment.status] ?? { label: shipment.status, variant: 'default' as const }
                  const transitions = SHIPMENT_TRANSITIONS[shipment.status]
                  return (
                    <div key={shipment.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">#{shipment.id}</span>
                        <Badge variant={shipmentStatusInfo.variant}>{shipmentStatusInfo.label}</Badge>
                      </div>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Proveedor</span>
                          <span className="font-medium text-gray-800 capitalize">
                            {SHIPMENT_PROVIDERS.find(p => p.value === shipment.provider)?.label ?? shipment.provider}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tracking</span>
                          <span className="font-mono text-xs text-gray-800">
                            {shipment.provider_tracking_id || 'Sin tracking'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Costo</span>
                          <span className="text-gray-800">
                            {shipment.costo === 0 ? 'Gratis' : formatCurrency(shipment.costo)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Estimado</span>
                          <span className="text-gray-800">
                            {shipment.estimated_days != null ? `${shipment.estimated_days} días hábiles` : 'No informado'}
                          </span>
                        </div>
                      </div>
                      {/* Acciones: Editar */}
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(shipment)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Editar envío
                        </Button>
                        {/* Acciones: Cambio de estado */}
                        {transitions && transitions.length > 0 && (
                          transitions.map(t => (
                            <Button
                              key={t.next}
                              variant={t.next === 'failed' ? 'danger' : 'primary'}
                              size="sm"
                              onClick={() => openStatusModal(shipment.id, shipment.status, t.next)}
                              disabled={updateShipmentStatus.loading}
                            >
                              {t.label}
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <Truck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {canCreateShipment
                    ? 'Sin envíos. Creá uno para comenzar.'
                    : 'Sin envíos registrados para este pedido.'}
                </p>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[#185749]" />
              <h3 className="font-bold text-gray-800 text-sm">Dirección de envío</h3>
            </div>

            {address ? (
              <div className="space-y-1 text-sm text-gray-600">
                {[address.calle, address.numero, address.piso && `Piso ${address.piso}`, address.departamento && `Depto ${address.departamento}`]
                  .filter(Boolean)
                  .length > 0 && (
                  <p>
                    {[address.calle, address.numero, address.piso && `Piso ${address.piso}`, address.departamento && `Depto ${address.departamento}`]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {address.ciudad && (
                  <p>{address.ciudad}{address.provincia ? `, ${address.provincia}` : ''}</p>
                )}
                {address.codigo_postal && <p>CP {address.codigo_postal}</p>}
                {address.pais && <p className="capitalize">{address.pais}</p>}
                {address.telefono && <p className="text-gray-400 mt-2">Tel: {address.telefono}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin dirección registrada</p>
            )}
          </div>

          {/* Notes */}
          {order.notas && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-[#185749]" />
                <h3 className="font-bold text-gray-800 text-sm">Notas del pedido</h3>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notas}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Buyer */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-[#185749]" />
              <h3 className="font-bold text-gray-800 text-sm">Comprador</h3>
            </div>
            <p className="text-sm text-gray-600">
              {order.buyer_nombre || <span className="text-gray-300">—</span>}
            </p>
          </div>

          {/* Status action */}
          {(() => {
            const transition = STATUS_TRANSITIONS[order.status]
            const canCancel = order.status === 'pending' || order.status === 'paid' || order.status === 'preparing'
            const isCancelled = order.status === 'cancelled'
            const isShipped = order.status === 'shipped'
            const isDelivered = order.status === 'delivered'

            if (isCancelled) {
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-4 h-4 text-[#185749]" />
                    <h3 className="font-bold text-gray-800 text-sm">Estado del pedido</h3>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Estado actual</span>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">Pedido cancelado.</p>
                </div>
              )
            }

            if (isDelivered) {
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-4 h-4 text-[#185749]" />
                    <h3 className="font-bold text-gray-800 text-sm">Estado del pedido</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Estado actual</span>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Este pedido ya no puede cancelarse.
                  </p>
                </div>
              )
            }

            const isPendingNeedsPayment = order.status === 'pending' && order.payment_status !== 'approved'

            return (
              <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-[#185749]" />
                  <h3 className="font-bold text-gray-800 text-sm">Estado del pedido</h3>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500">Estado actual</span>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
                {transition && (
                  isPendingNeedsPayment ? (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
                      El pago debe estar aprobado para marcar el pedido como pagado.
                    </p>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => { setActionError(null); setConfirmOpen(true) }}
                      disabled={updateOrderStatus.loading}
                    >
                      {transition.label}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )
                )}
                {isShipped && (
                  <p className="text-xs text-gray-400 mt-2">
                    Este pedido ya no puede cancelarse.
                  </p>
                )}
                {actionError && (
                  <p className="text-xs text-red-600 mt-2">{actionError}</p>
                )}
                {canCancel && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full"
                      onClick={() => { setCancelError(null); setCancelModalOpen(true) }}
                      disabled={cancelOrder.loading}
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar pedido
                    </Button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Financial summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[#185749]" />
              <h3 className="font-bold text-gray-800 text-sm">Resumen financiero</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-800">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Envío</span>
                <span className="text-gray-800">
                  {order.envio_costo > 0 ? formatCurrency(order.envio_costo) : 'Gratis'}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-black text-lg text-gray-800">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-[#185749]" />
              <h3 className="font-bold text-gray-800 text-sm">
                Pagos {order.payments.length > 0 && <span className="text-gray-400 font-normal">({order.payments.length})</span>}
              </h3>
            </div>
            {canVerifyPayment && (
              <div className="mb-4">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={handleVerifyPayment}
                  loading={verifyLoading}
                  disabled={verifyLoading}
                >
                  <RefreshCw className="w-4 h-4" />
                  Verificar pago con Mercado Pago
                </Button>
                {verifyResult && (
                  <p
                    className={`mt-2 text-xs rounded-lg p-2 ${
                      verifyResult.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
                    }`}
                  >
                    {verifyResult.message}
                  </p>
                )}
              </div>
            )}
            {order.payments.length > 0 ? (
              <div className="space-y-4">
                {order.payments.map(payment => {
                  const transitions = PAYMENT_TRANSITIONS[payment.status]
                  const hasSpecialNotice = payment.status === 'pending' && order.status === 'pending'
                  return (
                    <div key={payment.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">#{payment.id}</span>
                        <Badge variant={PAYMENT_STATUS_MAP[payment.status]?.variant ?? 'default'}>
                          {PAYMENT_STATUS_MAP[payment.status]?.label ?? payment.status}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Método</span>
                          <span className="font-medium text-gray-800 capitalize">
                            {payment.provider.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Monto</span>
                          <span className="font-medium text-gray-800">
                            {formatCurrency(payment.amount)} {payment.currency}
                          </span>
                        </div>
                      </div>
                      {hasSpecialNotice && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                          Al aprobar este pago, el pedido pasará a &ldquo;Pagado&rdquo; si todavía está &ldquo;Pendiente&rdquo;.
                        </p>
                      )}
                      {transitions && transitions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {transitions.map(t => (
                            <Button
                              key={t.next}
                              variant={t.next === 'approved' ? 'primary' : t.next === 'refunded' ? 'outline' : 'danger'}
                              size="sm"
                              onClick={() => openPaymentModal(payment.id, payment.status, t.next)}
                              disabled={updatePaymentStatus.loading}
                            >
                              {t.label}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Sin acciones disponibles.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin información de pago</p>
            )}
          </div>

          {/* Back button */}
          <Link
            to="/admin/pedidos"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-[#185749] border border-[#185749] rounded-lg hover:bg-[#185749]/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a pedidos
          </Link>
        </div>
      </div>

      {/* Confirmation modal */}
      {order && (() => {
        const transition = STATUS_TRANSITIONS[order.status]
        if (!transition) return null
        return (
          <Modal
            open={confirmOpen}
            onClose={() => { if (!updateOrderStatus.loading) setConfirmOpen(false) }}
            title="Confirmar cambio de estado"
          >
            <p className="text-sm text-gray-600 mb-4">
              ¿Confirmás cambiar el pedido de{' '}
              <span className="font-bold text-gray-800">&ldquo;{STATUS_LABELS[order.status]}&rdquo;</span>{' '}
              a{' '}
              <span className="font-bold text-gray-800">&ldquo;{STATUS_LABELS[transition.next]}&rdquo;</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={updateOrderStatus.loading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStatusTransition}
                loading={updateOrderStatus.loading}
              >
                Confirmar
              </Button>
            </div>
          </Modal>
        )
      })()}

      {/* Payment confirmation modal */}
      {selectedPayment && paymentActionTarget && (
        <Modal
          open={paymentModalOpen}
          onClose={() => { if (!updatePaymentStatus.loading) { setPaymentModalOpen(false); setSelectedPayment(null); setPaymentActionTarget(null) } }}
          title="Confirmar acción de pago"
        >
          <p className="text-sm text-gray-600 mb-4">
            ¿Confirmás cambiar el pago #{selectedPayment.id} de{' '}
            <span className="font-bold text-gray-800">&ldquo;{PAYMENT_LABELS[selectedPayment.currentStatus] ?? selectedPayment.currentStatus}&rdquo;</span>{' '}
            a{' '}
            <span className="font-bold text-gray-800">&ldquo;{PAYMENT_LABELS[paymentActionTarget] ?? paymentActionTarget}&rdquo;</span>?
          </p>
          {paymentActionTarget === 'approved' && order && order.status === 'pending' && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
              Al aprobar este pago, el pedido pasará de &ldquo;Pendiente&rdquo; a &ldquo;Pagado&rdquo; automáticamente.
            </p>
          )}
          {paymentActionError && (
            <p className="text-xs text-red-600 mb-4">{paymentActionError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPaymentModalOpen(false); setSelectedPayment(null); setPaymentActionTarget(null) }}
              disabled={updatePaymentStatus.loading}
            >
              Cancelar
            </Button>
            <Button
              variant={paymentActionTarget === 'approved' ? 'primary' : paymentActionTarget === 'refunded' ? 'outline' : 'danger'}
              size="sm"
              onClick={handlePaymentAction}
              loading={updatePaymentStatus.loading}
            >
              Confirmar
            </Button>
          </div>
        </Modal>
      )}

      {/* Cancel order confirmation modal */}
      {order && (
        <Modal
          open={cancelModalOpen}
          onClose={() => { if (!cancelOrder.loading) { setCancelModalOpen(false); setCancelReason('') } }}
          title="Cancelar pedido"
        >
          <p className="text-sm text-gray-600 mb-2">
            ¿Confirmás cancelar el pedido &ldquo;{order.numero_pedido}&rdquo;?
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Estado actual: <span className="font-bold">{STATUS_LABELS[order.status]}</span>.
            Esta acción cancelará el pedido y ejecutará la lógica correspondiente de liberación de stock, si existe una reserva.
          </p>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Motivo de cancelación (opcional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
              rows={3}
              placeholder="Explicá brevemente el motivo..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              disabled={cancelOrder.loading}
            />
          </div>
          {cancelError && (
            <p className="text-xs text-red-600 mb-4">{cancelError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCancelModalOpen(false); setCancelReason('') }}
              disabled={cancelOrder.loading}
            >
              Volver
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelOrder}
              loading={cancelOrder.loading}
            >
              Confirmar cancelación
            </Button>
          </div>
        </Modal>
      )}

      {/* Create shipment modal */}
      {order && (
        <Modal
          open={createModalOpen}
          onClose={() => { if (!createShipment.loading) { setCreateModalOpen(false); setCreateError(null) } }}
          title="Crear envío"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor *</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                value={createForm.provider}
                onChange={e => setCreateForm(prev => ({ ...prev, provider: e.target.value as ShipmentProvider }))}
                disabled={createShipment.loading}
              >
                {SHIPMENT_PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tracking (opcional)</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                placeholder="Ej: XX123456789AR"
                value={createForm.tracking}
                onChange={e => setCreateForm(prev => ({ ...prev, tracking: e.target.value }))}
                disabled={createShipment.loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Costo *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                  value={createForm.costo}
                  onChange={e => setCreateForm(prev => ({ ...prev, costo: e.target.value }))}
                  disabled={createShipment.loading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Días estimados</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                  placeholder="Opcional"
                  value={createForm.estimatedDays}
                  onChange={e => setCreateForm(prev => ({ ...prev, estimatedDays: e.target.value }))}
                  disabled={createShipment.loading}
                />
              </div>
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)} disabled={createShipment.loading}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateShipment} loading={createShipment.loading}>
              Crear envío
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit shipment modal */}
      {editTarget != null && (
        <Modal
          open={editModalOpen}
          onClose={() => { if (!updateShipment.loading) { setEditModalOpen(false); setEditTarget(null); setEditError(null) } }}
          title="Editar envío"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                value={editForm.provider}
                onChange={e => setEditForm(prev => ({ ...prev, provider: e.target.value as ShipmentProvider }))}
                disabled={updateShipment.loading}
              >
                {SHIPMENT_PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tracking</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                placeholder="Sin tracking"
                value={editForm.tracking}
                onChange={e => setEditForm(prev => ({ ...prev, tracking: e.target.value }))}
                disabled={updateShipment.loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Costo</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                  value={editForm.costo}
                  onChange={e => setEditForm(prev => ({ ...prev, costo: e.target.value }))}
                  disabled={updateShipment.loading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Días estimados</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 focus:border-[#185749]"
                  placeholder="No informado"
                  value={editForm.estimatedDays}
                  onChange={e => setEditForm(prev => ({ ...prev, estimatedDays: e.target.value }))}
                  disabled={updateShipment.loading}
                />
              </div>
            </div>
            {editError && <p className="text-xs text-red-600">{editError}</p>}
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" size="sm" onClick={() => { setEditModalOpen(false); setEditTarget(null) }} disabled={updateShipment.loading}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditShipment} loading={updateShipment.loading}>
              Guardar cambios
            </Button>
          </div>
        </Modal>
      )}

      {/* Shipment status change modal */}
      {statusTarget && (
        <Modal
          open={statusModalOpen}
          onClose={() => { if (!updateShipmentStatus.loading) { setStatusModalOpen(false); setStatusTarget(null); setStatusError(null) } }}
          title="Actualizar estado del envío"
        >
          <p className="text-sm text-gray-600 mb-4">
            ¿Confirmás cambiar el envío #{statusTarget.id} de{' '}
            <span className="font-bold text-gray-800">&ldquo;{SHIPMENT_STATUS_LABELS[statusTarget.currentStatus] ?? statusTarget.currentStatus}&rdquo;</span>{' '}
            a{' '}
            <span className="font-bold text-gray-800">&ldquo;{SHIPMENT_STATUS_LABELS[statusTarget.nextStatus] ?? statusTarget.nextStatus}&rdquo;</span>?
          </p>
          {statusTarget.nextStatus === 'failed' && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
              Este es un estado terminal. El envío no podrá recibir más cambios de estado.
            </p>
          )}
          {statusError && <p className="text-xs text-red-600 mb-4">{statusError}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setStatusModalOpen(false); setStatusTarget(null) }} disabled={updateShipmentStatus.loading}>
              Cancelar
            </Button>
            <Button
              variant={statusTarget.nextStatus === 'failed' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleStatusChange}
              loading={updateShipmentStatus.loading}
            >
              Confirmar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
