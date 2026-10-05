import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import { categoriesService, buildChildrenMap, collectSubtreeIds, type Category } from '../../services/categories.service'
import { useCatalog, useBrands } from '../../hooks/useProducts'
import type { SortOption } from '../../services/products.service'
import ProductCard from '../../components/home/ProductCard'
import { getCategoryIcon } from '../../lib/categoryIcons'

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const [categoria, setCategoria] = useState<Category | null>(null)
  const [subcategorias, setSubcategorias] = useState<Category[]>([])
  const [todasLasCategorias, setTodasLasCategorias] = useState<Category[]>([])
  const [loadingCat, setLoadingCat] = useState(true)
  const [errorCat, setErrorCat] = useState<string | null>(null)

  const q = searchParams.get('q') || ''
  const min = searchParams.get('min') || ''
  const max = searchParams.get('max') || ''
  const marca = searchParams.get('marca') || ''
  const subcat = searchParams.get('subcat') || ''
  const sort = (searchParams.get('sort') || 'recent') as SortOption
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))

  const [inputMin, setInputMin] = useState(min)
  const [inputMax, setInputMax] = useState(max)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(q)

  const { brands } = useBrands()

  useEffect(() => { setInputMin(min) }, [min])
  useEffect(() => { setInputMax(max) }, [max])
  useEffect(() => { setSearchValue(q) }, [q])

  useEffect(() => {
    if (!mobileFiltersOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobileFiltersOpen])

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      if (!slug) return
      setLoadingCat(true)
      setErrorCat(null)
      const { data } = await categoriesService.getBySlug(slug)
      if (cancelled) return
      if (!data) {
        setErrorCat('Categoría no encontrada')
        setLoadingCat(false)
        return
      }
      setCategoria(data)

      const { data: todas } = await categoriesService.getActive()
      if (cancelled) return
      const list = todas ?? []
      setTodasLasCategorias(list)
      setSubcategorias(list.filter(c => c.parent_id === data.id))

      setLoadingCat(false)
    }
    cargar()
    return () => { cancelled = true }
  }, [slug])

  // --- Jerarquía de categorías (resuelta en memoria, sin N+1) ---
  const childrenMap = useMemo(
    () => buildChildrenMap(todasLasCategorias),
    [todasLasCategorias],
  )

  // Raíz + todos los descendientes de la categoría actual (cualquier profundidad)
  const subtreeIds = useMemo(
    () => (categoria ? collectSubtreeIds(todasLasCategorias, categoria.id) : []),
    [categoria, todasLasCategorias],
  )

  const subcatCategory = useMemo(
    () => (subcat ? todasLasCategorias.find(c => c.slug === subcat) ?? null : null),
    [subcat, todasLasCategorias],
  )

  // Conjunto final a mostrar: si hay subcategoría filtrada, su subárbol
  // (validado para que NUNCA salga de la categoría padre), si no, el
  // subárbol completo de la categoría actual.
  const categoryIds = useMemo(() => {
    if (!subcatCategory) return subtreeIds
    const ids = collectSubtreeIds(todasLasCategorias, subcatCategory.id)
    const padreSet = new Set(subtreeIds)
    return ids.every(id => padreSet.has(id)) ? ids : subtreeIds
  }, [subcatCategory, todasLasCategorias, subtreeIds])

  const filters = useMemo(() => ({
    search: q || undefined,
    category_ids: categoria ? categoryIds : undefined,
    min_price: min ? Number(min) : undefined,
    max_price: max ? Number(max) : undefined,
    marca: marca || undefined,
    sort,
  }), [q, categoria, categoryIds, min, max, marca, sort])

  const {
    data: productos,
    total,
    loading,
    error,
    totalPages,
    goToPage,
    hasNext,
    hasPrev,
  } = useCatalog({
    page,
    pageSize: 24,
    filters,
    enabled: !!categoria,
  })

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in updates)) next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const termino = searchValue.trim()
    updateParams({ q: termino })
  }

  const handleClearSearch = () => {
    setSearchValue('')
    updateParams({ q: '' })
  }

  const handlePriceFilter = () => {
    const minVal = inputMin ? String(Math.max(0, Number(inputMin))) : ''
    const maxVal = inputMax ? String(Math.max(0, Number(inputMax))) : ''
    if (minVal && maxVal && Number(minVal) > Number(maxVal)) {
      updateParams({ min: maxVal, max: minVal })
    } else {
      updateParams({ min: minVal, max: maxVal })
    }
  }

  const handleBrandFilter = (brand: string) => {
    updateParams({ marca: brand === marca ? '' : brand })
  }

  const handleSubcategoryFilter = (subcatSlug: string) => {
    updateParams({ subcat: subcat === subcatSlug ? '' : subcatSlug })
  }

  const handleSortChange = (value: string) => {
    updateParams({ sort: value })
  }

  const handlePageChange = (newPage: number) => {
    goToPage(newPage)
    updateParams({ page: newPage > 1 ? String(newPage) : '' })
  }

  const handleClearFilters = () => {
    setSearchParams({}, { replace: true })
    setInputMin('')
    setInputMax('')
    setSearchValue('')
  }

  const hasActiveFilters = q || min || max || marca || subcat

  if (loadingCat) {
    return (
      <div className="min-h-screen bg-white">
        <div className="store-container py-8 sm:py-10">
          <div className="breadcrumb">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
            <span>/</span>
            <span className="breadcrumb-current">Categorías</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <div key={n} className="bg-gray-100 h-72 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (errorCat || !categoria) {
    return (
      <div className="min-h-screen bg-white">
        <div className="store-container py-8 sm:py-10">
          <div className="breadcrumb">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
            <span>/</span>
            <span className="breadcrumb-current">Categorías</span>
          </div>
          <div className="text-center py-20">
            <p className="text-h3 text-lg mb-2">{errorCat || 'Categoría no encontrada'}</p>
            <Link to="/" className="btn-primary-sm mt-4 inline-flex">Volver al inicio</Link>
          </div>
        </div>
      </div>
    )
  }

  // Nodos de subcategoría del sidebar, jerárquicos (hijos anidados
  // con indentación). Botones nativos: accesibles por teclado, con
  // aria-pressed para el estado seleccionado.
  const renderSubcategoryNode = (cat: Category, depth: number): ReactNode => {
    const nested = childrenMap.get(cat.id) ?? []
    const isActive = subcat === cat.slug
    return (
      <div key={cat.id}>
        <button
          type="button"
          onClick={() => handleSubcategoryFilter(cat.slug)}
          aria-pressed={isActive}
          className={`filter-option ${isActive ? 'filter-option-active' : 'filter-option-default'}`}
        >
          {cat.nombre}
        </button>
        {nested.length > 0 && depth < 5 && (
          <div className="ml-3 mt-1 space-y-1 border-l border-gray-100 pl-2">
            {nested.map(child => renderSubcategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const sidebarContent = (
    <>
      {hasActiveFilters && (
        <div className="filter-section">
          <div className="flex items-center justify-between mb-2">
            <span className="filter-title mb-0">Filtros activos</span>
            <button onClick={handleClearFilters} className="text-xs text-accent hover:text-primary-dark transition-colors cursor-pointer">
              Limpiar todo
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {q && <span className="filter-chip">Búsqueda: {q}</span>}
            {min && <span className="filter-chip">Mín: ${Number(min).toLocaleString('es-AR')}</span>}
            {max && <span className="filter-chip">Máx: ${Number(max).toLocaleString('es-AR')}</span>}
            {marca && <span className="filter-chip">Marca: {marca}</span>}
            {subcat && <span className="filter-chip">Subcategoría: {subcatCategory?.nombre ?? subcat}</span>}
          </div>
        </div>
      )}

      {subcategorias.length > 0 && (
        <div className="filter-section">
          <h3 className="filter-title">Subcategorías</h3>
          <div className="space-y-1">
            {subcategorias.map((sub) => renderSubcategoryNode(sub, 0))}
          </div>
        </div>
      )}

      <div className="filter-section">
        <h3 className="filter-title">Precio</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            placeholder="Mínimo"
            value={inputMin}
            onChange={(e) => setInputMin(e.target.value)}
            min="0"
            className="w-1/2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent bg-white"
          />
          <input
            type="number"
            placeholder="Máximo"
            value={inputMax}
            onChange={(e) => setInputMax(e.target.value)}
            min="0"
            className="w-1/2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent bg-white"
          />
        </div>
        <button
          onClick={handlePriceFilter}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Aplicar precio
        </button>
      </div>

      {brands.length > 0 && (
        <div className="filter-section">
          <h3 className="filter-title">Marcas</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => handleBrandFilter(brand)}
                className={`filter-option ${marca === brand ? 'filter-option-active' : 'filter-option-default'}`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <div className="store-container py-8 sm:py-10">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <span className="breadcrumb-current">{categoria.nombre}</span>
        </nav>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2 items-stretch">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                name="q"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={`Buscar en ${categoria.nombre}...`}
                className="search-input w-full pr-10"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button type="submit" className="search-btn shrink-0">
              Buscar
            </button>
          </div>
        </form>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-h2 text-2xl sm:text-3xl flex items-center gap-3">
            {(() => { const iconUrl = getCategoryIcon(categoria.slug); return iconUrl ? <img src={iconUrl} alt="" className="w-8 h-8 object-contain" /> : null })()}
            {categoria.nombre}
          </h1>
          <p className="text-body mt-1">
            {total} producto{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
          {subtreeIds.length > 1 && (
            <p className="text-body text-sm mt-1 text-gray-500">
              Mostrando productos de {categoria.nombre} y sus subcategorías.
            </p>
          )}
        </motion.div>

        {/* Subcategories */}
        {subcategorias.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {subcategorias.map((sub) => {
              const subIconUrl = getCategoryIcon(sub.slug)
              return (
                <Link
                  key={sub.id}
                  to={`/categoria/${sub.slug}`}
                  className="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border border-gray-200 text-gray-600 hover:border-accent hover:text-accent transition-all inline-flex items-center gap-1.5"
                >
                  {subIconUrl ? <img src={subIconUrl} alt="" className="w-4 h-4 object-contain" /> : null}
                  {sub.nombre}
                </Link>
              )
            })}
          </div>
        )}

        {/* Mobile filter toggle */}
        <button
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className="filter-toggle-btn"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-accent" />
          )}
        </button>

        {/* Mobile filter panel */}
        {mobileFiltersOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileFiltersOpen(false)}>
            <div
              className="absolute right-0 top-0 h-full w-80 max-w-[calc(100vw-2rem)] bg-white p-6 overflow-y-auto overflow-x-hidden shadow-xl overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-h3 text-lg">Filtros</h2>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                {sidebarContent}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar desktop */}
          <aside className="hidden lg:block lg:col-span-1 space-y-4">
            {sidebarContent}
          </aside>

          {/* Main content */}
          <div className="lg:col-span-3">
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-body">
                {total} resultado{total !== 1 ? 's' : ''}
              </span>
              <select
                value={sort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="sort-select"
              >
                <option value="recent">Más recientes</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="name_asc">Nombre A-Z</option>
                <option value="name_desc">Nombre Z-A</option>
              </select>
            </div>

            {/* Product grid */}
            {loading && productos.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <div key={n} className="bg-gray-100 h-72 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-body text-lg">{error}</p>
              </div>
            ) : productos.length === 0 ? (
              <div className="text-center py-20">
                {(() => { const iconUrl = getCategoryIcon(categoria.slug); return iconUrl ? <img src={iconUrl} alt="" className="w-16 h-16 object-contain mx-auto mb-4" /> : <p className="text-4xl mb-4">📦</p> })()}
                <p className="text-h3 text-lg mb-2">No se encontraron productos en {categoria.nombre}</p>
                <p className="text-body">Intentá con otros filtros o términos de búsqueda</p>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="mt-4 btn-primary-sm"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {productos.map((prod) => (
                    <motion.div
                      key={prod.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4 }}
                    >
                      <ProductCard product={prod} />
                    </motion.div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrev}
                      className="pagination-btn"
                    >
                      ← Anterior
                    </button>
                    <span className="pagination-info">
                      Página {page} de {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={!hasNext}
                      className="pagination-btn"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
