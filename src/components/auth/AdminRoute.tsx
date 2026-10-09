import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import LoadingScreen, { ErrorScreen } from '../ui/LoadingScreen'

// dark: tema elegido en el admin (el mismo que recibe AdminLayout), para no destellar en otro color
export default function AdminRoute({ dark = false }: { dark?: boolean }) {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login')
      } else if (profile && profile.role !== 'admin') {
        navigate('/')
      }
    }
  }, [loading, user, profile, navigate])

  if (loading) {
    return <LoadingScreen label="Verificando credenciales..." tone={dark ? 'dark' : 'light'} />
  }

  if (!user) return null

  if (!profile) {
    return (
      <ErrorScreen
        title="Error al cargar el perfil"
        description="No se pudo obtener la información del usuario."
        actionLabel="Reintentar"
        onAction={() => window.location.reload()}
        tone={dark ? 'dark' : 'light'}
      />
    )
  }

  if (profile.role !== 'admin') return null

  return <Outlet />
}
