import { useState, useEffect } from 'react'
import { categoriesService, type Categoria } from '../services/categories.service'

interface UseCategoriesState {
  data: Categoria[] | null
  loading: boolean
  error: string | null
}

export function useCategories() {
  const [state, setState] = useState<UseCategoriesState>({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await categoriesService.getAll()
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [])

  return state
}
