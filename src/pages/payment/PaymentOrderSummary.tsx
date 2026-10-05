import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { orderService, type OrderDetail } from '../../services/order.service'
import useAuth from '../../hooks/useAuth'

interface PaymentOrderSummaryProps {
  orderId: number | null
}

export default function PaymentOrderSummary({ orderId }: PaymentOrderSummaryProps) {
  const { user, loading } = useAuth()
  const [outcome, setOutcome] = useState<{ orderId: number; order: OrderDetail | null } | null>(null)
  const userId = user?.id

  useEffect(() => {
    if (!orderId || loading || !userId) return

    let cancelled = false
    orderService.getMyOrderById(orderId).then(({ data, error }) => {
      if (cancelled) return
      setOutcome({ orderId, order: error ? null : data })
    })

    return () => {
      cancelled = true
    }
  }, [orderId, loading, userId])

  if (!orderId) return null

  if (!loading && !userId) return null

  if (!outcome || outcome.orderId !== orderId) {
    return (
      <div className="w-full max-w-md mx-auto rounded-2xl border border-gray-100 p-5 space-y-3 animate-pulse mt-2">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-3 bg-gray-50 rounded w-2/3" />
        <div className="h-3 bg-gray-50 rounded w-1/2" />
      </div>
    )
  }

  if (!outcome.order) return null

  const { order } = outcome

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl border border-gray-100 p-5 sm:p-6 text-left space-y-4 mt-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400">Pedido</span>
        <span className="text-sm font-bold text-primary-dark">{order.numero_pedido}</span>
      </div>

      <div className="space-y-2.5">
        {order.order_items.map(item => (
          <div key={item.id} className="flex justify-between items-start gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-gray-600 break-words leading-snug">{item.nombre_producto}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {item.variante_nombre ? `${item.variante_nombre} · ` : ''}×{item.cantidad}
              </p>
            </div>
            <span className="shrink-0 whitespace-nowrap font-semibold text-primary-dark">
              ${item.subtotal.toLocaleString('es-AR')}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span>${order.subtotal.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Envío</span>
          <span className="text-gray-500">
            {order.envio_costo > 0 ? `$${order.envio_costo.toLocaleString('es-AR')}` : 'Gratis'}
          </span>
        </div>
        <div className="flex justify-between font-bold text-primary-dark pt-1">
          <span>Total</span>
          <span>${order.total.toLocaleString('es-AR')}</span>
        </div>
      </div>

      {/* pedido/:id usa el id numérico del pedido (no numero_pedido) */}
      <Link
        to={`/pedido/${order.id}`}
        className="inline-block text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded"
      >
        Ver detalle completo del pedido
      </Link>
    </div>
  )
}
