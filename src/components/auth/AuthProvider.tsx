import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import { profileService, type Profile } from '../../services/profile.service'
import { AuthContext } from './AuthContext'

interface AuthProviderProps {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        setSession(currentSession)
        if (!currentSession?.user) {
          setLoading(false)
        }
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      return
    }

    let cancelled = false

    profileService.getById(userId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Error loading profile:', error)
          setProfile(null)
        } else {
          setProfile(data)
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error loading profile:', error)
        setProfile(null)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ?? null }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { error: error ?? null, data: data?.user ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const user = session?.user ?? null

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
