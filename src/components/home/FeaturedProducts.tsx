import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductCard from './ProductCard'
import SectionHeader from '../ui/SectionHeader'
import type { ProductWithPrimaryImage } from '../../services/products.service'

interface FeaturedProductsProps {
  products: ProductWithPrimaryImage[]
  loading: boolean
}

export default function FeaturedProducts({ products, loading }: FeaturedProductsProps) {
  return (
    <section className="bg-white section-spacing">
      <div className="store-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <SectionHeader
            meta="Destacados"
            title="Productos seleccionados"
            right={
              <Link
                to="/busqueda"
                className="hidden sm:inline-flex items-center gap-1 text-primary font-bold text-sm hover:text-accent transition-colors"
              >
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </Link>
            }
          />
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-gray-100 h-72 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-12">
            No hay productos destacados en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((prod, i) => (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <ProductCard product={prod} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
