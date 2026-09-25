import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function IdentityCTA() {
  return (
    <section className="bg-primary-dark py-20 sm:py-28">
      <div className="store-container text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-display text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-6">
            Tecnología sin vueltas.
          </h2>
          <p className="text-white/70 text-sm sm:text-base mb-10 max-w-md mx-auto leading-relaxed">
            Iguazú Marketplace es tu tienda de tecnología de confianza. Productos reales, precios reales.
          </p>
          <Link to="/busqueda" className="btn-primary">
            Explorar productos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
