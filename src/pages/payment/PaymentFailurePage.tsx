import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { XCircle, RefreshCw, ArrowRight } from 'lucide-react'
import Button from '../../components/ui/Button'
import PaymentOrderSummary from './PaymentOrderSummary'

export default function PaymentFailurePage() {
  const [searchParams] = useSearchParams()
  const orderParam = searchParams.get('order')
  const orderId = orderParam && /^\d+$/.test(orderParam) ? Number(orderParam) : null

  return (
    <div className="bg-white min-h-screen">
      <div className="store-container section-spacing">
        <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li><Link to="/" className="breadcrumb-link">Inicio</Link></li>
            <li className="text-gray-300">/</li>
            <li className="breadcrumb-current">Pago no completado</li>
          </ol>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="flex flex-col items-center justify-center py-4 sm:py-12 text-center"
        >
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>

          <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark mb-3">
            El pago no pudo completarse
          </h1>

          <p className="text-body text-gray-500 mb-5 max-w-md leading-relaxed">
            Algo salió mal al procesar tu pago. Podés intentar nuevamente
            o elegir otro método de pago.
          </p>

          <PaymentOrderSummary orderId={orderId} />

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
            <Link to="/checkout">
              <Button variant="primary" size="lg">
                <RefreshCw className="w-4 h-4" />
                Intentar nuevamente
              </Button>
            </Link>
            <Link to="/busqueda">
              <Button variant="outline" size="lg">
                Seguir comprando
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
