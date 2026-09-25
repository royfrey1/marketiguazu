import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { categoriesService, type Category } from '../../services/categories.service'
import { getCategoryIcon } from '../../lib/categoryIcons'

interface CategoryWithChildren extends Category {
  children: Category[]
}

export default function CategoryIndexPage() {
  const [categorias, setCategorias] = useState<CategoryWithChildren[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setLoading(true)
      setError(null)
      const { data: roots, error: errRoots } = await categoriesService.getRoots()
      if (cancelled) return
      if (errRoots || !roots) {
        setError('No se pudieron cargar las categorías')
        setLoading(false)
        return
      }

      const withChildren: CategoryWithChildren[] = []
      for (const root of roots) {
        const { data: children } = await categoriesService.getChildren(root.id)
        withChildren.push({ ...root, children: children || [] })
      }
      if (!cancelled) {
        setCategorias(withChildren)
        setLoading(false)
      }
    }
    cargar()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="store-container py-8 sm:py-10">
          <nav className="breadcrumb">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
            <span>/</span>
            <span className="breadcrumb-current">Categorías</span>
          </nav>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="bg-gray-100 h-48 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="store-container py-8 sm:py-10">
          <nav className="breadcrumb">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
            <span>/</span>
            <span className="breadcrumb-current">Categorías</span>
          </nav>
          <div className="text-center py-20">
            <p className="text-h3 text-lg mb-2">{error}</p>
            <Link to="/" className="btn-primary-sm mt-4 inline-flex">Volver al inicio</Link>
          </div>
        </div>
      </div>
    )
  }

  if (categorias.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="store-container py-8 sm:py-10">
          <nav className="breadcrumb">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
            <span>/</span>
            <span className="breadcrumb-current">Categorías</span>
          </nav>
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📦</p>
            <p className="text-h3 text-lg mb-2">No hay categorías disponibles</p>
            <p className="text-body">Volvé al inicio para explorar productos</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="store-container py-8 sm:py-10">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <span className="breadcrumb-current">Categorías</span>
        </nav>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-h2 text-2xl sm:text-3xl">Explorá todas las categorías</h1>
          <p className="text-body mt-1">
            Descubrí productos organizados por categoría
          </p>
        </motion.div>

        {/* Category grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {categorias.map((cat, i) => {
            const iconUrl = getCategoryIcon(cat.slug)
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link
                  to={`/categoria/${cat.slug}`}
                  className="card group block p-5 sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="card-category-icon shrink-0 group-hover:bg-accent/10 transition-colors">
                      {iconUrl ? (
                        <img src={iconUrl} alt="" className="w-6 h-6 object-contain" />
                      ) : (
                        <span className="w-6 h-6 rounded bg-gray-200" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-h3 text-base sm:text-lg mb-1">
                        {cat.nombre}
                      </h2>
                      {cat.children.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {cat.children.map((child) => (
                            <span
                              key={child.id}
                              className="text-xs bg-primary-light/20 text-primary-dark px-2 py-0.5 rounded-md"
                            >
                              {child.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
