import { useState, useEffect, useCallback, useRef } from 'react'
import { productsService, type ProductWithPrimaryImage, type CatalogFilters } from '../services/products.service'

interface UseCatalogState {
  data: ProductWithPrimaryImage[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
}

interface UseCatalogOptions {
  page?: number
  pageSize?: number
  filters?: CatalogFilters
  enabled?: boolean
}

export function useCatalog(options: UseCatalogOptions = {}) {
  const { page = 1, pageSize = 24, filters = {}, enabled = true } = options

  const [state, setState] = useState<UseCatalogState>({
    data: [],
    total: 0,
    page,
    pageSize,
    loading: true,
    error: null,
  })

  const [currentPage, setCurrentPage] = useState(page)
  const prevFiltersRef = useRef<string>('')

  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const run = async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      try {
        const { data, total, error } = await productsService.getCatalog(currentPage, pageSize, filters)
        if (!cancelled) {
          setState(s => ({
            ...s,
            data: data || [],
            total,
            page: currentPage,
            pageSize,
            error: error?.message ?? null,
          }))
        }
      } catch (err) {
        if (!cancelled) {
          setState(s => ({
            ...s,
            data: [],
            total: 0,
            page: currentPage,
            pageSize,
            error: err instanceof Error ? err.message : 'No se pudo cargar el catálogo',
          }))
        }
      } finally {
        if (!cancelled) setState(s => ({ ...s, loading: false }))
      }
    }

    run()
    return () => { cancelled = true }
  }, [currentPage, pageSize, filtersKey, enabled])

  useEffect(() => {
    if (prevFiltersRef.current !== '' && prevFiltersRef.current !== filtersKey) {
      setCurrentPage(1)
    }
    prevFiltersRef.current = filtersKey
  }, [filtersKey])

  const goToPage = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const totalPages = Math.ceil(state.total / pageSize)

  return {
    ...state,
    totalPages,
    goToPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  }
}

export function useBrands() {
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await productsService.getBrands()
        if (!cancelled) setBrands(data)
      } catch {
        if (!cancelled) setBrands([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { brands, loading }
}
