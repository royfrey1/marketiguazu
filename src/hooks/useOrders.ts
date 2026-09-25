import { useState, useEffect, useCallback } from 'react'
import { orderService, type OrderListItem } from '../services/order.service'

interface UseOrdersState {
  data: OrderListItem[] | null
  loading: boolean
  error: string | null
}

export function useOrders() {
  const [state, setState] = useState<UseOrdersState>({ data: null, loading: true, error: null })

  const fetchOrders = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    const { data, error } = await orderService.getMyOrders()
    setState({ data, loading: false, error: error?.message ?? null })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, error } = await orderService.getMyOrders()
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [])

  return { ...state, refetch: fetchOrders }
}
