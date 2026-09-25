import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { Category } from '../../services/categories.service'
import SectionHeader from '../ui/SectionHeader'
import { getCategoryIcon } from '../../lib/categoryIcons'

const fallbackCategories = [
  { slug: 'smartphones', nombre: 'Smartphones' },
  { slug: 'laptops', nombre: 'Laptops' },
  { slug: 'audio', nombre: 'Audio' },
  { slug: 'monitores', nombre: 'Monitores' },
]

interface CategoriesSectionProps {
  categories?: Category[]
}

export default function CategoriesSection({ categories }: CategoriesSectionProps) {
  const rootCats = (categories && categories.length > 0
    ? categories
        .filter(c => !c.parent_id)
        .map(c => ({
          slug: c.slug || c.nombre.toLowerCase().replace(/\s+/g, '-'),
          nombre: c.nombre,
        }))
    : fallbackCategories
  ).slice(0, 4)

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
            meta="Explorá por categoría"
            title="Encontrá lo que buscás"
            right={
              <Link
                to="/categoria"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:text-accent/80 transition-colors"
              >
                Explorá todas las categorías
                <ArrowRight className="w-4 h-4" />
              </Link>
            }
          />
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {rootCats.map((cat, i) => {
            const iconUrl = getCategoryIcon(cat.slug)
            return (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link
                  to={`/categoria/${cat.slug}`}
                  className="card-category group"
                >
                  <div className="card-category-icon group-hover:bg-accent/10">
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="w-14 h-14 sm:w-14 sm:h-14 object-contain" />
                    ) : (
                      <span className="w-14 h-14 sm:w-10 sm:h-10 rounded bg-gray-200" />
                    )}
                  </div>
                  <span className="text-primary-dark text-xs sm:text-sm font-bold text-center leading-tight">
                    {cat.nombre}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link
            to="/categoria"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:text-accent/80 transition-colors"
          >
            Explorá todas las categorías
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
