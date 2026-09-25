import { useState, useEffect, useCallback, useRef } from 'react'
import {
  productsService,
  type ProductAdminRow,
  type AdminProductFilters,
} from '../services/products.service'

interface UseAdminProductsState {
  data: ProductAdminRow[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
}

interface UseAdminProductsOptions {
  page?: number
  pageSize?: number
  filters?: AdminProductFilters
  enabled?: boolean
}

export function useAdminProducts(options: UseAdminProductsOptions = {}) {
  const { page = 1, pageSize = 20, filters = {}, enabled = true } = options

  const [state, setState] = useState<UseAdminProductsState>({
    data: [],
    total: 0,
    page,
    pageSize,
    loading: true,
    error: null,
  })

  const [currentPage, setCurrentPage] = useState(page)
  const [refreshKey, setRefreshKey] = useState(0)
  const prevFiltersRef = useRef<string>('')

  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const run = async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, total, error } = await productsService.getAllAdmin(currentPage, pageSize, filters)
      if (!cancelled) {
        setState({
          data: data || [],
          total,
          page: currentPage,
          pageSize,
          loading: false,
          error: error?.message ?? null,
        })
      }
    }

    run()
    return () => { cancelled = true }
  }, [currentPage, pageSize, filtersKey, enabled, refreshKey])

  useEffect(() => {
    if (prevFiltersRef.current !== '' && prevFiltersRef.current !== filtersKey) {
      setCurrentPage(1)
    }
    prevFiltersRef.current = filtersKey
  }, [filtersKey])

  const goToPage = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const refetch = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const totalPages = Math.ceil(state.total / pageSize)

  return {
    ...state,
    totalPages,
    goToPage,
    refetch,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  }
}

export function useActiveCategories() {
  const [categories, setCategories] = useState<{ id: number; nombre: string; icono: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await import('../services/categories.service').then(m =>
        m.categoriesService.getActive()
      )
      if (!cancelled) setCategories(data ?? [])
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return { categories, loading }
}
