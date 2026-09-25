import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

export default function AdminRoute() {
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
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-cyan-400 animate-pulse">Verificando credenciales...</p>
      </div>
    )
  }

  if (!user) return null

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold">Error al cargar el perfil</p>
          <p className="text-gray-500 text-sm mt-2">No se pudo obtener la información del usuario.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (profile.role !== 'admin') return null

  return <Outlet />
}
