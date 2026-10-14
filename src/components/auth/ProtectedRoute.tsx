import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import LoadingScreen from '../ui/LoadingScreen'
import { withRedirect } from '../../lib/safeRedirect'

export default function ProtectedRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      // Después de iniciar sesión vuelve a la página pedida (por ejemplo /checkout)
      navigate(withRedirect('/login', `${location.pathname}${location.search}`))
    }
  }, [loading, user, navigate, location.pathname, location.search])

  if (loading) {
    return <LoadingScreen label="Cargando..." />
  }

  if (!user) return null

  return <Outlet />
}
