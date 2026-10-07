import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductCard from './ProductCard'
import { ProductGrid, ProductGridSkeleton } from '../store/ProductGrid'
import SectionHeader from '../ui/SectionHeader'
import type { ProductWithPrimaryImage } from '../../services/products.service'

interface TrendingSectionProps {
  products: ProductWithPrimaryImage[]
  loading: boolean
}

export default function TrendingSection({ products, loading }: TrendingSectionProps) {
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
            meta="Los más buscados"
            title="Trending ahora"
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
          <ProductGridSkeleton variant="full" count={4} />
        ) : products.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-12">
            No hay productos trending en este momento.
          </p>
        ) : (
          <ProductGrid variant="full">
            {products.map((prod, i) => (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <ProductCard product={prod} badge="Tendencia" badgeColor="bg-secondary" />
              </motion.div>
            ))}
          </ProductGrid>
        )}
      </div>
    </section>
  )
}
