import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, AlertTriangle, ArrowLeft, Truck } from 'lucide-react'
import useCart from '../../hooks/useCart'
import { CheckoutProvider } from '../../components/checkout/CheckoutContext'
import useCheckout from '../../hooks/useCheckout'
import CheckoutLayout from '../../components/checkout/CheckoutLayout'
import CheckoutStepEnvio from '../../components/checkout/CheckoutStepEnvio'
import CheckoutReview from '../../components/checkout/CheckoutReview'
import Button from '../../components/ui/Button'
import CartLoading from '../../components/cart/CartLoading'
import { CHECKOUT_ERROR_MESSAGES } from '../../types/checkout'
import type { AddressRow } from '../../services/address.service'

function CheckoutContent() {
  const { itemCount, loading, syncPending, error, unavailableItems, availabilityChecked } = useCart()
  const { setSelectedAddress, selectedShippingMethodId, setSelectedShippingMethodId, canProceedToPayment, validationError } = useCheckout()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)

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

  const handleEditShipping = () => {
    setCurrentStep(1)
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
                  <p className="text-xs text-gray-400 mt-0.5">Dirección y método de envío</p>
                </div>
              </div>
              <CheckoutStepEnvio
                onComplete={handleAddressComplete}
                selectedShippingMethodId={selectedShippingMethodId}
                onShippingMethodChange={setSelectedShippingMethodId}
              />
            </div>

            {/* Step 03 - Pago (disabled) */}
            <div className="rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-3 sm:space-y-4 opacity-50 overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-gray-400">Pago</h2>
                  <p className="text-xs text-gray-300 mt-0.5">Próximamente</p>
                </div>
              </div>
            </div>
          </div>

          {/* Validation error */}
          {validationError && (
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

          <CheckoutReview
            onEditAddress={handleEditAddress}
            onEditShipping={handleEditShipping}
          />

          {/* Actions */}
          <div className="mt-6 sm:mt-8 space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled
            >
              Ir a pagar (próximamente)
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
