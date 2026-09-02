import { useState, useEffect, useCallback } from 'react'
import { favoritesService } from '../services/favorites.service'

interface FavoriteRow {
  id: number
  publicaciones: {
    id: number
    titulo: string
    precio: number
    imagen_url: string | null
    categorias: { nombre: string; icono: string } | null
  } | null
}

interface UseFavoritesState {
  data: FavoriteRow[] | null
  loading: boolean
  error: string | null
}

export function useFavorites(userId: string | null) {
  const [state, setState] = useState<UseFavoritesState>({ data: null, loading: true, error: null })

  const fetchFavorites = useCallback(async () => {
    if (!userId) return
    setState(s => ({ ...s, loading: true, error: null }))
    const { data, error } = await favoritesService.getByUserId(userId)
    setState({ data, loading: false, error: error?.message ?? null })
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, error } = await favoritesService.getByUserId(userId)
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [userId])

  return { ...state, refetch: fetchFavorites }
}

export function useIsFavorite(userId: string | null, publicacionId: number) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data } = await favoritesService.check(userId, publicacionId)
      if (!cancelled) setIsFavorite(!!data)
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, publicacionId])

  const toggle = useCallback(async () => {
    if (!userId) return
    if (isFavorite) {
      await favoritesService.remove(userId, publicacionId)
      setIsFavorite(false)
    } else {
      await favoritesService.add(userId, publicacionId)
      setIsFavorite(true)
    }
  }, [userId, publicacionId, isFavorite])

  return { isFavorite, loading, toggle }
}
