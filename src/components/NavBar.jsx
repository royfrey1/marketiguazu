import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import logo from '../assets/logo2.png'

export default function NavBar() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <img className="h-16 w-auto" src={logo} alt="Logo" />
        <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link
              to="/dashboard"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Mi panel
            </Link>
            <Link
              to="/nueva-publicacion"
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-4 py-2 rounded-full text-sm font-bold transition-colors"
            >
              + Publicar
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-red-400 transition-colors"
            >
              Salir
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Ingresar
            </Link>
            <Link
              to="/register"
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-4 py-2 rounded-full text-sm font-bold transition-colors"
            >
              Registrarse
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}