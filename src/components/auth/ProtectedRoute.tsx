import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import LoadingScreen from '../ui/LoadingScreen'

export default function ProtectedRoute() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [loading, user, navigate])

  if (loading) {
    return <LoadingScreen label="Cargando..." />
  }

  if (!user) return null

  return <Outlet />
}
