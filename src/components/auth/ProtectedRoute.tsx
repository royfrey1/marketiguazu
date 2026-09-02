import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

export default function ProtectedRoute() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-cyan-400 animate-pulse">Cargando...</p>
      </div>
    )
  }

  if (!user) return null

  return <Outlet />
}
