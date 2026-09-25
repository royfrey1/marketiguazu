import { useState, useEffect, useCallback } from 'react'
import { orderService, type OrderAdminDetail } from '../services/order.service'

interface UseAdminOrderState {
  data: OrderAdminDetail | null
  loading: boolean
  error: string | null
}

export function useAdminOrder(orderId: number | null | undefined) {
  const [state, setState] = useState<UseAdminOrderState>({
    data: null,
    loading: !!orderId,
    error: null,
  })

  const fetchOrder = useCallback(async () => {
    if (!orderId) return
    setState(s => ({ ...s, loading: true, error: null }))
    const { data, error } = await orderService.getAdminOrderById(orderId)
    setState({ data, loading: false, error: error?.message ?? null })
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    ;(async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, error } = await orderService.getAdminOrderById(orderId)
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [orderId])

  return { ...state, refetch: fetchOrder }
}
