import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="bg-hero overflow-hidden">
      <div className="store-container py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Columna izquierda - Texto */}
          <div className="order-2 lg:order-1">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-meta mb-4"
            >
              Iguazú Marketplace
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-display text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] mb-6"
            >
              <span className="text-primary-dark">Encontra </span>
              <span className="text-accent"><br /> los productos </span>
              <span className="text-primary-dark"><br /> que buscas.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-body-dark text-base sm:text-lg max-w-md mb-8"
            >
              Productos informaticos, Smartphones, Perfumes y mucho más. Encontrá los productos que necesitás con los mejores precios de Argentina.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Link to="/busqueda" className="btn-primary">
                Explorar productos
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/busqueda" className="btn-outline">
                Ver ofertas
              </Link>
            </motion.div>
          </div>

          {/* Columna derecha - Imagen */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="order-1 lg:order-2 relative"
          >
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/20 to-transparent" />
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent/20 rounded-full blur-2xl" />
            <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary-light/40 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
