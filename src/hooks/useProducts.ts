import { useState, useEffect, useCallback } from 'react'
import { productsService, type Publicacion } from '../services/products.service'

interface UseProductsState {
  data: Publicacion[] | null
  loading: boolean
  error: string | null
}

export function useProducts() {
  const [state, setState] = useState<UseProductsState>({ data: null, loading: true, error: null })

  const fetchAll = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    const { data, error } = await productsService.getActivePublications()
    setState({ data, loading: false, error: error?.message ?? null })
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, error } = await productsService.getActivePublications()
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    }
    run()
    return () => { cancelled = true }
  }, [])

  return { ...state, refetch: fetchAll }
}

export function useProductById(id: number | null) {
  const [state, setState] = useState<{ data: Publicacion | null; loading: boolean; error: string | null }>({
    data: null, loading: true, error: null,
  })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await productsService.getById(id)
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [id])

  return state
}

export function useProductsByUserId(userId: string | null) {
  const [state, setState] = useState<UseProductsState>({ data: null, loading: true, error: null })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await productsService.getByUserId(userId)
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [userId])

  return state
}
