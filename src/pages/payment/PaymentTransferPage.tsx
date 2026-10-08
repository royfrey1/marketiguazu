import { useEffect, useState } from 'react'
import Seo from '../../components/seo/Seo'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Landmark, ShoppingBag, CheckCircle, Clock, MessageCircle, AlertTriangle, Info } from 'lucide-react'
import Button from '../../components/ui/Button'
import PaymentOrderSummary from './PaymentOrderSummary'
import CopyButton from './CopyButton'
import useAuth from '../../hooks/useAuth'
import useClearCartOnOrder from '../../hooks/useClearCartOnOrder'
import { orderService, type TransferPaymentInfo } from '../../services/order.service'
import { whatsappUrl } from '../../lib/whatsapp'

// Plazo para transferir desde que se crea el pago (igual que USDT)
const PAYMENT_WINDOW_HOURS = 24

function formatArs(amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`
}

function formatDeadline(createdAt: string): string | null {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return null
  return new Date(created + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

// Solo alias y CBU se copian; titular y banco son texto estático (select-none es cosmético)
function AccountRow({ label, value, mono = false, copyable = false }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 pl-3">
      <div className="flex-1 min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
        <dd className={`text-sm text-primary-dark break-all ${mono ? 'font-mono' : 'font-semibold'} ${copyable ? '' : 'select-none'}`}>{value}</dd>
      </div>
      {copyable && <CopyButton value={value} label={`Copiar ${label === 'CBU' ? label : label.toLowerCase()}`} />}
    </div>
  )
}

export default function PaymentTransferPage() {
  const [searchParams] = useSearchParams()
  const orderParam = searchParams.get('order')
  const orderId = orderParam && /^\d+$/.test(orderParam) ? Number(orderParam) : null

  // El pedido ya quedó registrado: se vacía el carrito igual que en USDT.
  // Excepción: si se llegó desde el checkout porque un pedido anterior seguía
  // pendiente (keepCart), el carrito actual es de otra compra y no se toca.
  const location = useLocation()
  const keepCart = (location.state as { keepCart?: boolean } | null)?.keepCart === true
  useClearCartOnOrder(keepCart ? null : orderId)

  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [outcome, setOutcome] = useState<{ orderId: number; payment: TransferPaymentInfo | null } | null>(null)

  useEffect(() => {
    if (!orderId || authLoading || !userId) return
    let cancelled = false
    orderService.getMyTransferPayment(orderId).then(({ data, error }) => {
      if (!cancelled) setOutcome({ orderId, payment: error ? null : data })
    })
    return () => { cancelled = true }
  }, [orderId, authLoading, userId])

  const loadingPayment = !!orderId && (authLoading || (!!userId && (!outcome || outcome.orderId !== orderId)))
  const payment = outcome?.orderId === orderId ? outcome.payment : null
  const isPending = payment?.status === 'pending'
  const isApproved = payment?.status === 'approved'
  // Cancelado, rechazado o cualquier otro estado final: no se debe transferir nada
  const isClosed = !!payment && !isPending && !isApproved
  const deadline = isPending && payment ? formatDeadline(payment.createdAt) : null
  const ordersLink = orderId && payment ? `/pedido/${orderId}` : '/pedidos'
  // Desde lg: 2 columnas mientras carga y con el pago pendiente; el resto de los estados sigue centrado
  const twoColumns = loadingPayment || (!!payment && isPending)

  return (
    <div className="bg-white min-h-screen">
      <Seo noindex title="Pago por transferencia" />
      <div className={`store-container section-spacing ${twoColumns ? 'lg:py-6' : ''}`}>
        <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li><Link to="/" className="breadcrumb-link">Inicio</Link></li>
            <li className="text-gray-300">/</li>
            <li className="breadcrumb-current">Pago por transferencia</li>
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
          {/* Columna izquierda (lg): encabezado, monto, cuenta y concepto. Debajo de lg no genera caja */}
          <div className={twoColumns ? 'contents lg:flex lg:flex-col lg:items-start' : 'contents'}>
            {/* Desde lg el ícono va al lado del título para ahorrar alto */}
            <div className={twoColumns ? 'contents lg:flex lg:items-center lg:gap-4 lg:mb-3' : 'contents'}>
              <div className={`w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mb-6 shrink-0 ${twoColumns ? 'lg:w-14 lg:h-14 lg:mb-0' : ''}`}>
                <Landmark className={`w-10 h-10 text-accent ${twoColumns ? 'lg:w-7 lg:h-7' : ''}`} aria-hidden="true" />
              </div>

              <h1 className={`text-h2 text-2xl sm:text-3xl text-primary-dark mb-1 ${twoColumns ? 'lg:mb-0' : ''}`}>
                {isApproved ? 'Pago confirmado' : isClosed ? 'Pedido cancelado' : 'Pagá con transferencia bancaria'}
              </h1>
            </div>
            {payment && (
              <p className="text-sm text-gray-500 mb-5">Pedido #{payment.referencia}</p>
            )}

            {loadingPayment && (
              <div className="w-full max-w-md mx-auto rounded-2xl border border-gray-100 p-5 space-y-3 animate-pulse lg:max-w-none" aria-busy="true" aria-label="Cargando datos de pago">
                <div className="h-8 bg-gray-100 rounded w-1/2 mx-auto" />
                <div className="h-3 bg-gray-50 rounded w-1/3 mx-auto" />
                <div className="h-10 bg-gray-50 rounded" />
                <div className="h-10 bg-gray-50 rounded" />
              </div>
            )}

            {!loadingPayment && isApproved && (
              <p className="w-full max-w-md mx-auto flex items-start gap-2 text-left text-sm font-medium text-green-700 bg-green-50 rounded-xl p-4">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                Ya confirmamos la transferencia de este pedido. ¡Gracias! Podés seguir el estado en Mis pedidos.
              </p>
            )}

            {!loadingPayment && isClosed && (
              <div className="w-full max-w-md mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 text-left" role="alert">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium text-amber-800">
                      Este pedido ya no tiene un pago por transferencia pendiente. No realices ninguna transferencia. Si ya transferiste, escribinos y lo resolvemos.
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

            {!loadingPayment && payment && isPending && (
              <div className="w-full max-w-md mx-auto rounded-t-2xl border border-b-0 border-gray-100 p-4 sm:p-6 pb-0 sm:pb-0 text-left space-y-6 lg:max-w-none lg:rounded-2xl lg:border-b lg:pb-6">
                {/* Monto */}
                <section aria-labelledby="transfer-amount">
                  <h2 id="transfer-amount" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Monto exacto a transferir
                  </h2>
                  <p className="text-price text-3xl sm:text-4xl break-all">{formatArs(payment.amountArs)}</p>
                  <p className="mt-1 text-xs text-gray-500">En pesos argentinos, precio de contado sin recargo.</p>
                </section>

                {/* Cuenta */}
                <section aria-labelledby="transfer-account">
                  <h2 id="transfer-account" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Datos de la cuenta
                  </h2>
                  <dl className="space-y-2">
                    <AccountRow label="Titular" value={payment.titular} />
                    {payment.banco && <AccountRow label="Banco" value={payment.banco} />}
                    {payment.alias && <AccountRow label="Alias" value={payment.alias} mono copyable />}
                    {payment.cbu && <AccountRow label="CBU" value={payment.cbu} mono copyable />}
                  </dl>
                </section>

                {/* Concepto */}
                <section aria-labelledby="transfer-reference" className="rounded-xl border border-accent/40 bg-accent/5 p-3">
                  <h2 id="transfer-reference" className="text-sm font-bold text-primary-dark mb-2">
                    Indicá este número de pedido como concepto
                  </h2>
                  <p className="text-lg font-bold font-mono text-primary-dark break-all">{payment.referencia}</p>
                </section>
              </div>
            )}
          </div>

          {/* Columna derecha (lg): plazo, avisos, resumen y acciones */}
          <div className={twoColumns ? 'contents lg:flex lg:flex-col lg:items-stretch lg:[&>div]:max-w-none' : 'contents'}>
            {loadingPayment && (
              <div className="hidden lg:block w-full rounded-2xl border border-gray-100 p-6 space-y-3 animate-pulse" aria-hidden="true">
                <div className="h-12 bg-gray-50 rounded" />
                <div className="h-12 bg-gray-50 rounded" />
                <div className="h-12 bg-gray-50 rounded" />
              </div>
            )}

            {!loadingPayment && payment && isPending && (
              <div className="w-full max-w-md mx-auto rounded-b-2xl border border-t-0 border-gray-100 p-4 sm:p-6 pt-6 sm:pt-6 text-left lg:rounded-2xl lg:border-t">
                {/* Plazo y avisos */}
                <div className="space-y-3">
                  <p className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Tenés {PAYMENT_WINDOW_HOURS} horas para realizar la transferencia
                      {deadline && <> (hasta el <strong className="font-semibold text-primary-dark">{deadline}</strong>)</>}.
                    </span>
                  </p>
                  <p className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                    Transferí el total exacto. Cuando recibamos el pago lo confirmamos manualmente y tu pedido pasa a &ldquo;pagado&rdquo;. Podés ver el estado en Mis pedidos.
                  </p>
                  <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    Si la transferencia no se acredita dentro del plazo, el pedido se cancela y el stock se libera.
                  </p>
                </div>
              </div>
            )}

            {whatsappUrl && !loadingPayment && isPending && (
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
              <div className="w-full max-w-md mx-auto text-sm text-gray-500 bg-gray-50 rounded-xl p-4 space-y-2" role="status">
                <p>
                  {!orderId
                    ? 'No encontramos el pedido.'
                    : !userId
                      ? 'Iniciá sesión para ver los datos de pago de tu pedido.'
                      : 'No encontramos un pago por transferencia para este pedido. Revisá el estado en Mis pedidos. Si el problema sigue, escribinos.'}
                </p>
                {orderId && !userId ? (
                  <Link to="/login" className="inline-block font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded">
                    Iniciar sesión
                  </Link>
                ) : (
                  <Link to="/pedidos" className="inline-block font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded">
                    Ver Mis pedidos
                  </Link>
                )}
              </div>
            )}

            <PaymentOrderSummary orderId={orderId} />

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
              <Link to={ordersLink}>
                <Button variant="primary" size="lg">
                  Ir a Mis pedidos
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" size="lg">
                  <ShoppingBag className="w-4 h-4" />
                  Seguir comprando
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
