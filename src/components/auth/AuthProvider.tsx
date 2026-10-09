import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import { profileService, type Profile } from '../../services/profile.service'
import { AuthContext } from './AuthContext'

// Tiempo máximo de espera para la sesión inicial y para el perfil. Si vence, se deja de mostrar
// la carga (la sesión no se borra) y una respuesta que llegue después se aplica igual.
const AUTH_TIMEOUT_MS = 10_000

interface AuthProviderProps {
  children: ReactNode
}

/** Perfil ya resuelto (con datos, o null por error/timeout) y el usuario al que corresponde. */
interface ResolvedProfile {
  userId: string
  profile: Profile | null
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  // true cuando ya se sabe si hay sesión: respondió getSession, falló, venció el timeout o llegó un evento
  const [sessionResolved, setSessionResolved] = useState(false)
  const [resolvedProfile, setResolvedProfile] = useState<ResolvedProfile | null>(null)
  // Un evento de onAuthStateChange es más nuevo que la respuesta de getSession: si ya llegó, manda él
  const authEventSeenRef = useRef(false)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      if (!active) return
      console.error('Auth: la sesión no respondió a tiempo; se continúa sin esperar')
      setSessionResolved(true)
    }, AUTH_TIMEOUT_MS)

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!active || authEventSeenRef.current) return
        setSession(currentSession)
      })
      .catch((error) => {
        if (active) console.error('Error loading session:', error)
      })
      .finally(() => {
        clearTimeout(timer)
        if (active) setSessionResolved(true)
      })

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      authEventSeenRef.current = true
      setSession(newSession)
      setSessionResolved(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    // Sin usuario no hay nada que cargar: loading se deriva en false y profile en null (ver abajo)
    if (!userId) return

    let active = true
    const timer = setTimeout(() => {
      if (!active) return
      console.error('Auth: el perfil no respondió a tiempo')
      setResolvedProfile({ userId, profile: null })
    }, AUTH_TIMEOUT_MS)

    profileService.getById(userId)
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error('Error loading profile:', error)
        // Aunque haya vencido el timeout, una respuesta tardía del mismo usuario se aplica
        setResolvedProfile({ userId, profile: error ? null : data })
      })
      .catch((error) => {
        if (!active) return
        console.error('Error loading profile:', error)
        setResolvedProfile({ userId, profile: null })
      })
      .finally(() => clearTimeout(timer))

    // Si cambia el usuario, el efecto nuevo es el que resuelve; este solo deja de escribir
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [userId])

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
    setResolvedProfile(null)
  }

  const user = session?.user ?? null
  // El perfil solo vale si corresponde al usuario actual (evita mostrar el de una sesión anterior)
  const profileReady = !!user && resolvedProfile?.userId === user.id
  const profile = profileReady ? resolvedProfile.profile : null
  // Cargando = todavía no se sabe quién es el usuario o su perfil no se resolvió. Así, entre el login
  // y la llegada del perfil se ve la pantalla de carga y no un "Error al cargar el perfil" momentáneo
  const loading = !sessionResolved || (!!user && !profileReady)

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
