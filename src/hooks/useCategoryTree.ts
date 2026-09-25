import { useState, useEffect, useCallback, useRef } from 'react'
import { categoriesService, type CategoryWithChildren } from '../services/categories.service'

interface UseCategoryTreeReturn {
  roots: CategoryWithChildren[]
  loading: boolean
  error: string | null
  loadChildren: (parentId: number) => Promise<CategoryWithChildren[]>
}

export function useCategoryTree(): UseCategoryTreeReturn {
  const [roots, setRoots] = useState<CategoryWithChildren[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const childrenCacheRef = useRef<Map<number, CategoryWithChildren[]>>(new Map())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await categoriesService.getRoots()
      if (!cancelled) {
        if (err) {
          setError(err.message)
          setRoots([])
        } else {
          setRoots(data ?? [])
        }
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const loadChildren = useCallback(async (parentId: number): Promise<CategoryWithChildren[]> => {
    const cached = childrenCacheRef.current.get(parentId)
    if (cached) return cached

    const { data, error: err } = await categoriesService.getChildren(parentId)
    if (err || !data) return []

    const children = data.filter(c => c.activo)
    childrenCacheRef.current.set(parentId, children)
    return children
  }, [])

  return { roots, loading, error, loadChildren }
}
