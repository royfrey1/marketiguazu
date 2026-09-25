import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="store-container py-8 sm:py-10">
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <span className="breadcrumb-current">Página no encontrada</span>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20"
        >
          <p className="text-6xl mb-6">🔍</p>
          <h1 className="text-h2 text-2xl sm:text-3xl mb-3">Página no encontrada</h1>
          <p className="text-body mb-8 max-w-md mx-auto">
            La ruta que intentás visitar no existe o fue movida.
          </p>
          <Link to="/" className="btn-primary">
            Volver al inicio
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
