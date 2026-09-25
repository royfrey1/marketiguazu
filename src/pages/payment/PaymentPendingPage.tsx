import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Home, ArrowRight } from 'lucide-react'
import Button from '../../components/ui/Button'

export default function PaymentPendingPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="store-container section-spacing">
        <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li><Link to="/" className="breadcrumb-link">Inicio</Link></li>
            <li className="text-gray-300">/</li>
            <li className="breadcrumb-current">Pago pendiente</li>
          </ol>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="flex flex-col items-center justify-center py-4 sm:py-12 text-center"
        >
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>

          <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark mb-3">
            Pago en procesamiento
          </h1>

          <p className="text-body text-gray-500 mb-5 max-w-md leading-relaxed">
            Tu pago está siendo verificado. Esto puede tardar unos minutos.
            Te notificaremos por email cuando se confirme.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link to="/">
              <Button variant="primary" size="lg">
                <Home className="w-4 h-4" />
                Volver al inicio
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
