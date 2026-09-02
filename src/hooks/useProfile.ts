import { useState, useEffect, useCallback } from 'react'
import { profileService, type Profile } from '../services/profile.service'

interface UseProfileState {
  data: Profile | null
  loading: boolean
  error: string | null
}

export function useProfile(userId: string | null) {
  const [state, setState] = useState<UseProfileState>({ data: null, loading: true, error: null })

  const fetchProfile = useCallback(async () => {
    if (!userId) return
    setState(s => ({ ...s, loading: true, error: null }))
    const { data, error } = await profileService.getById(userId)
    setState({ data, loading: false, error: error?.message ?? null })
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, error } = await profileService.getById(userId)
      if (!cancelled) setState({ data, loading: false, error: error?.message ?? null })
    })()
    return () => { cancelled = true }
  }, [userId])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!userId) return { error: new Error('No user') }
    const { data, error } = await profileService.update(userId, updates)
    if (!error && data) setState(s => ({ ...s, data }))
    return { data, error }
  }, [userId])

  return { ...state, refetch: fetchProfile, updateProfile }
}
