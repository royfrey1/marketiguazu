import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, AlertTriangle, ArrowLeft, Truck, Coins } from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { sileo } from 'sileo'
import useCart from '../../hooks/useCart'
import { CheckoutProvider } from '../../components/checkout/CheckoutContext'
import useCheckout from '../../hooks/useCheckout'
import CheckoutLayout from '../../components/checkout/CheckoutLayout'
import CheckoutStepEnvio from '../../components/checkout/CheckoutStepEnvio'
import CheckoutReview from '../../components/checkout/CheckoutReview'
import Button from '../../components/ui/Button'
import CartLoading from '../../components/cart/CartLoading'
import { CHECKOUT_ERROR_MESSAGES, PAYMENT_ERROR_MESSAGES, type PaymentErrorCode } from '../../types/checkout'
import { supabase } from '../../lib/supabase/client'
import type { AddressRow } from '../../services/address.service'

interface CreatePaymentSuccess {
  success: true
  orderId: number
  orderNumber: string | null
  initPoint: string
}

interface CreateUsdtPaymentSuccess {
  success: true
  orderId: number
  orderNumber: string | null
  amountArs: number
  amountUsdt: number
  exchangeRate: number
  walletAddress: string
  network: string
}

type PaymentMethod = 'mercadopago' | 'usdt'

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string; hint: string; icon: typeof CreditCard }[] = [
  { value: 'mercadopago', label: 'Mercado Pago', hint: 'Tarjeta, débito o hasta 3 cuotas', icon: CreditCard },
  { value: 'usdt', label: 'USDT (TRC20)', hint: 'Transferencia cripto, confirmación manual', icon: Coins },
]

async function extractPaymentError(error: unknown): Promise<{ code: PaymentErrorCode; message: string; orderId?: number }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json() as { error?: { code?: string; message?: string }; orderId?: unknown }
      if (body?.error?.code && body.error.code in PAYMENT_ERROR_MESSAGES) {
        return {
          code: body.error.code as PaymentErrorCode,
          message: body.error.message ?? '',
          // Solo en PENDING_USDT_ORDER: el pedido USDT pendiente que bloquea el checkout
          orderId: typeof body.orderId === 'number' ? body.orderId : undefined,
        }
      }
    } catch {
      // la respuesta no tenía JSON válido
    }
  }
  return { code: 'INTERNAL_ERROR', message: '' }
}

function CheckoutContent() {
  const { itemCount, loading, syncPending, error, unavailableItems, availabilityChecked } = useCart()
  const { setSelectedAddress, selectedShippingMethodId, canProceedToPayment, validationError, buildSnapshot } = useCheckout()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [isPaying, setIsPaying] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mercadopago')

  useEffect(() => {
    if (!loading && !syncPending && itemCount === 0) {
      navigate('/carrito', { replace: true })
    }
  }, [loading, syncPending, itemCount, navigate])

  useEffect(() => {
    if (availabilityChecked && unavailableItems.size > 0) {
      navigate('/carrito', { replace: true })
    }
  }, [availabilityChecked, unavailableItems, navigate])

  const handleAddressComplete = useCallback((address: AddressRow) => {
    setSelectedAddress(address)
  }, [setSelectedAddress])

  const handleContinueToReview = () => {
    if (!canProceedToPayment) return
    setCurrentStep(2)
  }

  const handleEditAddress = () => {
    setCurrentStep(1)
  }

  // Error de create-payment / create-payment-usdt. Con un pedido USDT pendiente
  // (PENDING_USDT_ORDER) no se puede iniciar otro checkout: se lleva al usuario a
  // las instrucciones de ese pedido en vez de dejarlo bloqueado sin explicación.
  const handlePaymentError = async (invokeError: unknown) => {
    const failure = await extractPaymentError(invokeError)
    if (failure.code === 'PENDING_USDT_ORDER' && failure.orderId) {
      sileo.warning({
        title: 'Ya tenés un pedido pendiente de pago con USDT',
        description: 'Te mostramos los datos para completar la transferencia.',
      })
      // keepCart: el carrito actual es de una compra nueva, no del pedido pendiente
      navigate(`/pago/usdt?order=${failure.orderId}`, { state: { keepCart: true } })
      return
    }
    sileo.error({
      title: 'No pudimos procesar el pago',
      description: PAYMENT_ERROR_MESSAGES[failure.code] ?? PAYMENT_ERROR_MESSAGES.INTERNAL_ERROR,
    })
  }

  const handlePay = async () => {
    if (isPaying || !canProceedToPayment) return

    const snapshot = buildSnapshot()
    if (!snapshot) {
      sileo.error({
        title: 'No pudimos preparar el pago',
        description: CHECKOUT_ERROR_MESSAGES[validationError ?? 'CHECKOUT_NOT_READY'],
      })
      return
    }

    setIsPaying(true)
    try {
      const body = {
        addressId: snapshot.selectedAddress.id,
        items: snapshot.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.cantidad,
        })),
      }

      if (paymentMethod === 'usdt') {
        const { data: usdt, error: usdtError } = await supabase.functions.invoke<CreateUsdtPaymentSuccess>('create-payment-usdt', { body })

        if (usdtError) {
          await handlePaymentError(usdtError)
          return
        }

        if (!usdt?.success || !usdt.orderId) {
          sileo.error({
            title: 'No pudimos procesar el pago',
            description: PAYMENT_ERROR_MESSAGES.INTERNAL_ERROR,
          })
          return
        }

        // Flujo interno: las instrucciones de pago se muestran en la tienda
        navigate(`/pago/usdt?order=${usdt.orderId}`)
        return
      }

      const { data, error: invokeError } = await supabase.functions.invoke<CreatePaymentSuccess>('create-payment', { body })

      if (invokeError) {
        await handlePaymentError(invokeError)
        return
      }

      if (!data?.success || !data.initPoint) {
        sileo.error({
          title: 'No pudimos procesar el pago',
          description: PAYMENT_ERROR_MESSAGES.INTERNAL_ERROR,
        })
        return
      }

      window.location.href = data.initPoint
    } catch {
      sileo.error({
        title: 'No pudimos procesar el pago',
        description: PAYMENT_ERROR_MESSAGES.INTERNAL_ERROR,
      })
    } finally {
      setIsPaying(false)
    }
  }

  if (loading || syncPending) {
    return (
      <div className="bg-white min-h-screen">
        <div className="store-container section-spacing">
          <CartLoading />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <Link to="/" className="text-accent text-sm hover:underline font-medium">
            Volver a la tienda
          </Link>
        </div>
      </div>
    )
  }

  if (itemCount === 0) return null

  return (
    <CheckoutLayout activeStep={1} selectedShippingMethodId={selectedShippingMethodId}>
      {currentStep === 1 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Breadcrumb */}
          <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm">
              <li><Link to="/" className="breadcrumb-link">Inicio</Link></li>
              <li className="text-gray-300">/</li>
              <li><Link to="/carrito" className="breadcrumb-link">Carrito</Link></li>
              <li className="text-gray-300">/</li>
              <li className="breadcrumb-current">Envío</li>
            </ol>
          </nav>

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-6 h-6 text-primary-dark" />
              <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark">Finalizá tu compra</h1>
            </div>
            <p className="text-body text-gray-500 ml-9">
              Completá tus datos de contacto y dirección de envío.
            </p>
          </div>

          <div className="space-y-4 sm:space-y-5">
            {/* Step 02 - Envío */}
            <div className="rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center text-sm font-bold shrink-0">
                  02
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-primary-dark">Envío</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Dirección de entrega</p>
                </div>
              </div>
              <CheckoutStepEnvio
                onComplete={handleAddressComplete}
              />
            </div>

            {/* Step 03 - Pago */}
            <div className="rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-primary-dark">Pago</h2>
                  <p className="text-xs text-gray-400 mt-0.5">En el último paso elegís Mercado Pago o USDT (TRC20)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Validation error (PHONE_REQUIRED ya se muestra en el paso de dirección, con "Agregar teléfono") */}
          {validationError && validationError !== 'PHONE_REQUIRED' && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4" role="alert">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-amber-700 font-medium">
                    {CHECKOUT_ERROR_MESSAGES[validationError]}
                  </p>
                  {validationError === 'PRICE_CHANGED' && (
                    <Link
                      to="/carrito"
                      className="inline-block mt-2 text-xs sm:text-sm font-semibold text-amber-700 underline hover:text-amber-800"
                    >
                      Revisar carrito
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 sm:mt-8 space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!canProceedToPayment}
              onClick={handleContinueToReview}
            >
              Continuar a revisión
            </Button>

            <Link to="/carrito">
              <Button variant="ghost" size="md" className="w-full">
                <ArrowLeft className="w-4 h-4" />
                Volver al carrito
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Breadcrumb */}
          <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm">
              <li><Link to="/" className="breadcrumb-link">Inicio</Link></li>
              <li className="text-gray-300">/</li>
              <li><Link to="/carrito" className="breadcrumb-link">Carrito</Link></li>
              <li className="text-gray-300">/</li>
              <li className="breadcrumb-current">Revisión</li>
            </ol>
          </nav>

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-6 h-6 text-primary-dark" />
              <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark">Revisá tu pedido</h1>
            </div>
            <p className="text-body text-gray-500 ml-9">
              Verificá que todo esté correcto antes de continuar al pago.
            </p>
          </div>

          <CheckoutReview onEditAddress={handleEditAddress} />

          {/* Payment method */}
          <fieldset className="mt-6 sm:mt-8">
            <legend className="text-sm font-bold text-primary-dark mb-3">Medio de pago</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PAYMENT_METHOD_OPTIONS.map(option => {
                const selected = paymentMethod === option.value
                return (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 rounded-xl border p-3 sm:p-4 cursor-pointer transition-colors ${
                      selected ? 'border-accent bg-accent/5' : 'border-gray-200 hover:border-gray-300'
                    } ${isPaying ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPaymentMethod(option.value)}
                      disabled={isPaying}
                      className="accent-accent w-4 h-4 shrink-0"
                    />
                    <option.icon className={`w-5 h-5 shrink-0 ${selected ? 'text-accent' : 'text-gray-400'}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-primary-dark">{option.label}</span>
                      <span className="block text-xs text-gray-400">{option.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Actions */}
          <div className="mt-6 sm:mt-8 space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!canProceedToPayment || isPaying}
              loading={isPaying}
              onClick={handlePay}
            >
              {isPaying ? 'Procesando…' : paymentMethod === 'usdt' ? 'Confirmar pedido y ver datos de pago' : 'Ir a pagar'}
            </Button>

            <Button
              variant="ghost"
              size="md"
              className="w-full"
              onClick={handleEditAddress}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al envío
            </Button>
          </div>
        </motion.div>
      )}
    </CheckoutLayout>
  )
}

export default function CheckoutPage() {
  return (
    <CheckoutProvider>
      <CheckoutContent />
    </CheckoutProvider>
  )
}
