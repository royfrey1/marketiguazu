import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SlidersHorizontal, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useCatalog, useBrands } from '../../hooks/useProducts'
import { categoriesService, type Category } from '../../services/categories.service'
import type { SortOption } from '../../services/products.service'
import ProductCard from '../../components/home/ProductCard'
import { ProductGrid, ProductGridSkeleton } from '../../components/store/ProductGrid'
import { getCategoryIcon } from '../../lib/categoryIcons'

export default function Busqueda() {
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') || ''
  const cat = searchParams.get('cat') || ''
  const min = searchParams.get('min') || ''
  const max = searchParams.get('max') || ''
  const marca = searchParams.get('marca') || ''
  const sort = (searchParams.get('sort') || 'recent') as SortOption
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))

  const [inputMin, setInputMin] = useState(min)
  const [inputMax, setInputMax] = useState(max)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(q)
  const [manualExpanded, setManualExpanded] = useState<Set<number>>(() => new Set())
  const [manualCollapsed, setManualCollapsed] = useState<Set<number>>(() => new Set())

  const { brands } = useBrands()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await categoriesService.getActive()
      if (!cancelled) setCategorias((data || []) as Category[])
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => { setInputMin(min) }, [min])
  useEffect(() => { setInputMax(max) }, [max])
  useEffect(() => { setSearchValue(q) }, [q])

  // Lock body scroll when mobile filter panel is open
  useEffect(() => {
    if (!mobileFiltersOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobileFiltersOpen])

  const filters = useMemo(() => ({
    search: q || undefined,
    category_id: cat ? Number(cat) : undefined,
    min_price: min ? Number(min) : undefined,
    max_price: max ? Number(max) : undefined,
    marca: marca || undefined,
    sort,
  }), [q, cat, min, max, marca, sort])

  const {
    data: productos,
    total,
    loading,
    error,
    totalPages,
    goToPage,
    hasNext,
    hasPrev,
  } = useCatalog({ page, pageSize: 24, filters })

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

  const handleSortChange = (value: string) => {
    updateParams({ sort: value })
  }

  const handleCategoryFilter = (categoryId: number | null) => {
    updateParams({ cat: categoryId ? String(categoryId) : '' })
  }

  const handleClearFilters = () => {
    setSearchParams({}, { replace: true })
    setInputMin('')
    setInputMax('')
  }

  const handlePageChange = (newPage: number) => {
    goToPage(newPage)
    updateParams({ page: newPage > 1 ? String(newPage) : '' })
  }

  const hasActiveFilters = q || cat || min || max || marca

  const childrenByParent = useMemo(() => {
    const map = new Map<number, Category[]>()
    for (const item of categorias) {
      if (item.parent_id == null) continue
      const list = map.get(item.parent_id)
      if (list) list.push(item)
      else map.set(item.parent_id, [item])
    }
    return map
  }, [categorias])

  const rootCategories = useMemo(
    () =>
      categorias.filter(
        item =>
          item.parent_id == null ||
          !categorias.some(parent => parent.id === item.parent_id)
      ),
    [categorias]
  )

  const autoExpandedParents = useMemo(() => {
    const ids = new Set<number>()
    if (!cat) return ids
    const selectedId = Number(cat)
    let current = categorias.find(item => item.id === selectedId)
    while (current?.parent_id != null) {
      ids.add(current.parent_id)
      current = categorias.find(item => item.id === current.parent_id)
    }
    return ids
  }, [cat, categorias])

  const isCategoryExpanded = useCallback((categoryId: number) => {
    if (manualCollapsed.has(categoryId)) return false
    if (manualExpanded.has(categoryId)) return true
    return autoExpandedParents.has(categoryId)
  }, [manualCollapsed, manualExpanded, autoExpandedParents])

  const toggleCategoryExpanded = useCallback(
    (categoryId: number) => {
      const wasOpen = isCategoryExpanded(categoryId)
      setManualExpanded(prev => {
        const next = new Set(prev)
        if (wasOpen) next.delete(categoryId)
        else next.add(categoryId)
        return next
      })
      setManualCollapsed(prev => {
        const next = new Set(prev)
        if (wasOpen) next.add(categoryId)
        else next.delete(categoryId)
        return next
      })
    },
    [isCategoryExpanded]
  )

  const renderCategoryNode = (catItem: Category, depth: number): React.ReactNode => {
    const children = childrenByParent.get(catItem.id) ?? []
    const hasChildren = children.length > 0
    const isActive = cat === String(catItem.id)
    const expanded = hasChildren && isCategoryExpanded(catItem.id)
    const catIconUrl = getCategoryIcon(catItem.slug)
    const childrenId = `category-children-${catItem.id}`
    const indent =
      depth === 0
        ? ''
        : 'ml-3 pl-2.5 border-l border-gray-100'

    if (!hasChildren) {
      return (
        <button
          key={catItem.id}
          onClick={() => handleCategoryFilter(catItem.id)}
          className={`filter-option ${isActive ? 'filter-option-active' : 'filter-option-default'} ${indent}`}
        >
          {catIconUrl ? (
            <img src={catIconUrl} alt="" className="w-4 h-4 object-contain inline-block mr-1" />
          ) : null}
          {catItem.nombre}
        </button>
      )
    }

    return (
      <div key={catItem.id} className={indent}>
        <div
          className={`rounded-lg ${
            isActive ? 'filter-option-active' : 'filter-option-default'
          }`}
        >
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => handleCategoryFilter(catItem.id)}
              className="flex-1 min-w-0 text-left flex items-center gap-1.5 px-3 py-2 rounded-l-lg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              {catIconUrl ? (
                <img src={catIconUrl} alt="" className="w-4 h-4 object-contain shrink-0" />
              ) : null}
              <span className="truncate">{catItem.nombre}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleCategoryExpanded(catItem.id)}
              aria-expanded={expanded}
              aria-controls={childrenId}
              aria-label={
                expanded
                  ? `Contraer subcategorías de ${catItem.nombre}`
                  : `Expandir subcategorías de ${catItem.nombre}`
              }
              className="shrink-0 px-2 flex items-center justify-center rounded-r-lg text-gray-500 hover:text-primary-dark hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent cursor-pointer"
            >
              {expanded ? (
                <ChevronDown
                  className="w-4 h-4 transition-transform duration-150 ease-out motion-reduce:transition-none"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="w-4 h-4 transition-transform duration-150 ease-out motion-reduce:transition-none"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>

        <div
          id={childrenId}
          className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`py-1 space-y-1 ${expanded ? 'visible' : 'invisible'}`}>
              {children.map(child => renderCategoryNode(child, depth + 1))}
            </div>
          </div>
        </div>
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
            {cat && <span className="filter-chip">Categoría: {categorias.find(c => c.id === Number(cat))?.nombre}</span>}
            {min && <span className="filter-chip">Mín: ${Number(min).toLocaleString('es-AR')}</span>}
            {max && <span className="filter-chip">Máx: ${Number(max).toLocaleString('es-AR')}</span>}
            {marca && <span className="filter-chip">Marca: {marca}</span>}
          </div>
        </div>
      )}

      <div className="filter-section">
        <h3 className="filter-title">Categorías</h3>
        <div className="space-y-1">
          <button
            onClick={() => handleCategoryFilter(null)}
            className={`filter-option ${!cat ? 'filter-option-active' : 'filter-option-default'}`}
          >
            Todas
          </button>
          {rootCategories.map(catItem => renderCategoryNode(catItem, 0))}
        </div>
      </div>

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
          <span className="breadcrumb-current">Productos</span>
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
                placeholder="Buscar productos..."
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
          <h1 className="text-h2 text-2xl sm:text-3xl">
            {q ? `Resultados para "${q}"` : 'Todos los productos'}
          </h1>
          <p className="text-body mt-1">
            {total} producto{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        </motion.div>

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
              <ProductGridSkeleton variant="withSidebar" count={6} />
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-body text-lg">{error}</p>
              </div>
            ) : productos.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🔍</p>
                <p className="text-h3 text-lg mb-2">No se encontraron productos</p>
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
                <ProductGrid variant="withSidebar">
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
                </ProductGrid>

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
