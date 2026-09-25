import { useState, useEffect, useCallback } from 'react'
import { orderService, type OrderDetail } from '../services/order.service'

interface UseOrderState {
  data: OrderDetail | null
  loading: boolean
  error: string | null
}

export function useOrder(orderId: number | null | undefined) {
  const [state, setState] = useState<UseOrderState>({
    data: null,
    loading: !!orderId,
    error: null,
  })

  const fetchOrder = useCallback(async () => {
    if (!orderId) return
    setState(s => ({ ...s, loading: true, error: null }))
    const { data, error } = await orderService.getMyOrderById(orderId)
    setState({ data, loading: false, error: error?.message ?? null })
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    ;(async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, error } = await orderService.getMyOrderById(orderId)
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [orderId])

  return { ...state, refetch: fetchOrder }
}
