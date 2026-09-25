import { useState, useEffect, useCallback, useRef } from 'react'
import {
  orderService,
  type OrderAdminListItem,
  type AdminOrderFilters,
} from '../services/order.service'

interface UseAdminOrdersState {
  data: OrderAdminListItem[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
}

interface UseAdminOrdersOptions {
  page?: number
  pageSize?: number
  filters?: AdminOrderFilters
  enabled?: boolean
}

export function useAdminOrders(options: UseAdminOrdersOptions = {}) {
  const { page = 1, pageSize = 20, filters = {}, enabled = true } = options

  const [state, setState] = useState<UseAdminOrdersState>({
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
      const { data, total, error } = await orderService.getAllAdmin(currentPage, pageSize, filters)
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
