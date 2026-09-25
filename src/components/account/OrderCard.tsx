import { Link } from 'react-router-dom'
import { Calendar, Truck, Package } from 'lucide-react'
import Badge from '../ui/Badge'
import type { OrderListItem } from '../../services/order.service'

interface OrderCardProps {
  order: OrderListItem
}

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

export default function OrderCard({ order }: OrderCardProps) {
  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, variant: 'default' as const }
  const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, variant: 'default' as const }

  return (
    <Link
      to={`/pedido/${order.id}`}
      className="block bg-white rounded-xl border border-gray-100 p-5 sm:p-6 hover:border-primary-light hover:shadow-md transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-primary-dark">
              Pedido {order.numero_pedido}
            </h3>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(order.created_at)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
          </div>

          {order.metodo_envio && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Truck className="w-3.5 h-3.5" />
              <span>{order.metodo_envio}</span>
            </div>
          )}
        </div>

        <div className="sm:text-right">
          <p className="text-xl font-black text-primary-dark">{formatCurrency(order.total)}</p>
          {order.envio_costo > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Envío {formatCurrency(order.envio_costo)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
