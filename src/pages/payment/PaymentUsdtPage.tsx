import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coins, Home, CheckCircle, Clock, MessageCircle, AlertTriangle } from 'lucide-react'
import Button from '../../components/ui/Button'
import PaymentOrderSummary from './PaymentOrderSummary'
import CopyButton from './CopyButton'
import useAuth from '../../hooks/useAuth'
import useClearCartOnOrder from '../../hooks/useClearCartOnOrder'
import { orderService, type UsdtPaymentInfo } from '../../services/order.service'
import { whatsappUrl } from '../../lib/whatsapp'

export default function PaymentUsdtPage() {
  const [searchParams] = useSearchParams()
  const orderParam = searchParams.get('order')
  const orderId = orderParam && /^\d+$/.test(orderParam) ? Number(orderParam) : null

  // El pedido ya quedó registrado: se vacía el carrito igual que en éxito/pendiente.
  // Excepción: si se llegó desde el checkout porque un pedido USDT anterior seguía
  // pendiente (keepCart), el carrito actual es de otra compra y no se toca.
  const location = useLocation()
  const keepCart = (location.state as { keepCart?: boolean } | null)?.keepCart === true
  useClearCartOnOrder(keepCart ? null : orderId)

  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [outcome, setOutcome] = useState<{ orderId: number; payment: UsdtPaymentInfo | null } | null>(null)

  useEffect(() => {
    if (!orderId || authLoading || !userId) return
    let cancelled = false
    orderService.getMyUsdtPayment(orderId).then(({ data, error }) => {
      if (!cancelled) setOutcome({ orderId, payment: error ? null : data })
    })
    return () => { cancelled = true }
  }, [orderId, authLoading, userId])

  const loadingPayment = !!orderId && !!userId && (!outcome || outcome.orderId !== orderId)
  const payment = outcome?.orderId === orderId ? outcome.payment : null
  const isPending = payment?.status === 'pending'
  const isApproved = payment?.status === 'approved'
  // Cancelado, rechazado o cualquier otro estado final: no se debe transferir nada
  const isClosed = !!payment && !isPending && !isApproved
  // Desde lg: 2 columnas mientras carga y con el pago pendiente; el resto de los estados sigue centrado
  const twoColumns = loadingPayment || (!!payment && isPending)

  return (
    <div className="bg-white min-h-screen">
      <div className={`store-container section-spacing ${twoColumns ? 'lg:py-6' : ''}`}>
        <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li><Link to="/" className="breadcrumb-link">Inicio</Link></li>
            <li className="text-gray-300">/</li>
            <li className="breadcrumb-current">Pago con USDT</li>
          </ol>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className={`flex flex-col items-center justify-center py-4 sm:py-12 text-center ${
            twoColumns ? 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12 lg:py-0 lg:text-left' : ''
          }`}
        >
          {/* Columna izquierda (lg): encabezado, monto y wallet. Debajo de lg no genera caja */}
          <div className={twoColumns ? 'contents lg:flex lg:flex-col lg:items-start' : 'contents'}>
            {/* Desde lg el ícono va al lado del título para ahorrar alto */}
            <div className={twoColumns ? 'contents lg:flex lg:items-center lg:gap-4 lg:mb-3' : 'contents'}>
              <div className={`w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mb-6 shrink-0 ${twoColumns ? 'lg:w-14 lg:h-14 lg:mb-0' : ''}`}>
                <Coins className={`w-10 h-10 text-accent ${twoColumns ? 'lg:w-7 lg:h-7' : ''}`} />
              </div>

              <h1 className={`text-h2 text-2xl sm:text-3xl text-primary-dark mb-3 ${twoColumns ? 'lg:mb-0' : ''}`}>
                {isApproved ? 'Pago confirmado' : isClosed ? 'Pedido cancelado' : 'Pagá con USDT'}
              </h1>
            </div>

            {/* Solo con el pago pendiente se pide la transferencia */}
            {isPending && (
              <p className="text-body text-gray-500 mb-5 max-w-md leading-relaxed">
                Transferí el monto exacto a esta dirección (red TRC20). Te vamos a confirmar el pago por WhatsApp o email en las próximas horas. También vas a ver el estado en Mis pedidos.
              </p>
            )}

            {loadingPayment && (
              <div className="w-full max-w-md mx-auto rounded-2xl border border-gray-100 p-5 space-y-3 animate-pulse lg:max-w-none">
                <div className="h-8 bg-gray-100 rounded w-1/2 mx-auto" />
                <div className="h-3 bg-gray-50 rounded w-1/3 mx-auto" />
                <div className="h-10 bg-gray-50 rounded" />
              </div>
            )}

            {!loadingPayment && isClosed && (
              <div className="w-full max-w-md mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 text-left" role="alert">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium text-amber-800">
                      Este pedido fue cancelado. No realices ninguna transferencia. Si ya transferiste, escribinos por WhatsApp y lo resolvemos.
                    </p>
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 underline hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded"
                      >
                        <MessageCircle className="w-4 h-4" aria-hidden="true" />
                        Escribinos por WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!loadingPayment && payment && !isClosed && (
              <div className={`w-full max-w-md mx-auto border border-gray-100 p-5 sm:p-6 text-left space-y-5 ${
                isPending ? 'rounded-t-2xl border-b-0 pb-0 sm:pb-0 lg:max-w-none lg:rounded-2xl lg:border-b lg:pb-6' : 'rounded-2xl'
              }`}>
                {payment.status === 'approved' && (
                  <p className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg p-3">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Ya confirmamos este pago. ¡Gracias!
                  </p>
                )}

                {/* Monto */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    {isApproved ? 'Monto transferido' : 'Monto a transferir'}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-price text-3xl sm:text-4xl break-all">
                      {payment.amountUsdt.toLocaleString('es-AR', { maximumFractionDigits: 2 })} <span className="text-xl sm:text-2xl">USDT</span>
                    </p>
                    {isPending && <CopyButton value={String(payment.amountUsdt)} label="Copiar monto en USDT" />}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    1 USDT ≈ ${payment.exchangeRate.toLocaleString('es-AR')} ARS · Total del pedido ${payment.amountArs.toLocaleString('es-AR')}
                  </p>
                </div>

                {/* Wallet */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Dirección de wallet · red {payment.network}
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 pl-3">
                    <code className="flex-1 min-w-0 text-sm text-primary-dark break-all">{payment.walletAddress}</code>
                    {isPending && <CopyButton value={payment.walletAddress} label="Copiar dirección de wallet" />}
                  </div>
                  {isPending && (
                    <p className="mt-2 text-xs text-amber-700">
                      Usá únicamente la red {payment.network}. Un envío por otra red puede perderse.
                    </p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Columna derecha (lg): plazo, resumen y acciones */}
          <div className={twoColumns ? 'contents lg:flex lg:flex-col lg:items-stretch lg:[&>div]:max-w-none' : 'contents'}>
            {loadingPayment && (
              <div className="hidden lg:block w-full rounded-2xl border border-gray-100 p-6 space-y-3 animate-pulse" aria-hidden="true">
                <div className="h-12 bg-gray-50 rounded" />
              </div>
            )}

            {!loadingPayment && payment && isPending && (
              <div className="w-full max-w-md mx-auto rounded-b-2xl border border-t-0 border-gray-100 p-5 sm:p-6 pt-5 sm:pt-5 text-left lg:rounded-2xl lg:border-t lg:pt-6">
                <p className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                  Tenés 24 horas para realizar la transferencia: pasado ese plazo el pedido se cancela automáticamente.
                </p>
              </div>
            )}

            {whatsappUrl && !loadingPayment && !isApproved && !isClosed && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                ¿Dudas o querés cambiar el método de pago? Escribinos por WhatsApp
              </a>
            )}

            {!loadingPayment && !payment && (
              <p className="w-full max-w-md mx-auto text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
                {!orderId
                  ? 'No encontramos el pedido.'
                  : !authLoading && !userId
                    ? 'Iniciá sesión para ver los datos de pago de tu pedido.'
                    : 'No pudimos cargar los datos de pago. Probá recargar la página o revisá el pedido en Mis pedidos. Si el problema sigue, escribinos por WhatsApp.'}
              </p>
            )}

            <PaymentOrderSummary orderId={orderId} />

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
              <Link to="/">
                <Button variant="primary" size="lg">
                  <Home className="w-4 h-4" />
                  Volver al inicio
                </Button>
              </Link>
              <Link to="/pedidos">
                <Button variant="outline" size="lg">
                  Ver mis pedidos
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
