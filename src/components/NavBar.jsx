import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import logo from '../assets/iguazu1.png'
import logosolo from '../assets/logosolo.png'
import { useLocation } from 'react-router-dom'

export default function NavBar() {
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
    navigate('/')
  }
 
  if (location.pathname === '/login') {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
        <nav className="max-w-7xl w-auto flex items-center justify-between px-6 py-2 w-[95%] md:w-[85%] bg-[#1CAAA8]/10 backdrop-blur-md rounded-full border-2 border-[#B5E3D4]/30">
          <Link to="/">
            <img src={logo} alt="Logo" className="h-20 w-auto" />
          </Link>
          <Link to="/register" className="shadow-xl shadow-[#1CAAA8]/20 transition-all duration-300 hover:shadow-[#1CAAA8]/50 hover:scale-105 text-[#B5E3D4] font-bold text-lg hover:text-white transition-colors px-4 py-2 rounded-full border border-[#B5E3D4]/30 hover:border-white/50 ">
            Crear nueva cuenta
          </Link>
        </nav>
      </header>
    )
  }

   if (location.pathname === '/register') {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
        <nav className="max-w-7xl w-auto flex items-center justify-between px-6 py-2 w-[95%] md:w-[85%] bg-[#1CAAA8]/10 backdrop-blur-md rounded-full border-2 border-[#B5E3D4]/30">
          <Link to="/">
            <img src={logo} alt="Logo" className="h-20 w-auto" />
          </Link>
          <Link to="/login" className="shadow-xl shadow-[#1CAAA8]/20 transition-all duration-300 hover:shadow-[#1CAAA8]/50 hover:scale-105 text-[#B5E3D4] font-bold text-lg hover:text-white transition-colors px-4 py-2 rounded-full border border-[#B5E3D4]/30 hover:border-white/50 ">
            Iniciar sesión
          </Link>
        </nav>
      </header>
    )
  }

  return (
    // Contenedor principal para el posicionamiento
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pl-4 pr-4 pb-4 pt-2 transition-all duration-500">
      
      <nav className={`
        flex items-center justify-between px-6 transition-all duration-500
        rounded-full border-2 border-[#B5E3D4]
        ${isScrolled 
          ? 'w-[95%] md:w-[90%] bg-[#B5E3D4]/95 backdrop-blur-md shadow-2xl py-1.5' // Un poquito más de padding vertical
          : 'w-full bg-[#B5E3D4]/50 backdrop-blur-sm shadow-none py-3 '
        }
      `}>
        
        {/* Logo */}
        <Link to="/" className="flex-shrink-0 flex items-center">
          <img 
            src={logo} 
            alt="Iguazú Marketplace" 
            className={`transition-all duration-300 object-contain ${
              isScrolled 
                ? 'h-14 md:h-16' // Tamaño mínimo al scrollear (un poco más grande que antes)
                : 'h-20 md:h-24' // Tamaño original imponente
            }`} 
          />
        </Link>

        {/* Buscador - Ahora más estilizado */}
        <div className="hidden md:flex flex-1 max-w-md mx-6 relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos..."
            className={`w-full rounded-full px-6 py-4 text-lg transition-all duration-300 outline-none
              ${isScrolled 
                ? 'bg-emerald-50 py-4 px-6 text-sm text-emerald-900 border-emerald-900 focus:ring-2 focus:ring-emerald-400' 
                : 'bg-white/30 text-white placeholder:text-white/70 border border-[#389C52]/40 hover:border-[#1CAAA8] transition-colors'
              }
            `}
          />
          <button onClick={() => navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 cursor-pointer">🔍</span>
          </button>
          
        </div>

        {/* Acciones */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link 
                to="/dashboard" 
                className={` font-bold bg-[#1CAAA8] px-10 py-2 rounded-full text-lg font-bold hover:brightness-95 transition-all shadow-sm border-1 border-[#185749]/20 hover:bg-[#B5E3D4]/50 hover:border-emerald-900 ${isScrolled ? 'text-emerald-900 text-sm' : 'text-white'}`}
              >
                Panel
              </Link>
              <button onClick={handleLogout} className={`text-lg cursor-pointer bg-white/50 border-1 border-white text-emerald-900 px-10 py-2 rounded-full font-bold hover:brightness-95 transition-all shadow-sm hover:bg-red-500/10 hover:text-red-500 hover:border-red-400 ${isScrolled ? 'text-emerald-900 text-sm' : 'text-white'}`}>
                Salir
              </button>
            </>
          ) : (
            <> 
              <Link to="/login" className={`text-lg font-bold ${isScrolled ? 'text-emerald-900 text-sm' : 'text-white'}`}>
                Ingresar
              </Link>
              <Link 
                to="/register" 
                className={`bg-[#B5E3D4] px-5 py-2 rounded-full text-lg font-bold shadow-md hover:bg-emerald-50 transition-all ${isScrolled ? 'text-[#0D3732] text-sm' : 'text-[#0D3732]'}`}
              >
                Registrarme
              </Link>
            </>
          )}
        </div>

        {/* Menú Mobile Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`md:hidden p-2 rounded-full ${isScrolled ? 'text-emerald-900' : 'text-white'}`}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Menú Mobile (Versión Flotante) */}
      <div className={`
        absolute top-20 left-1/2 -translate-x-1/2 w-[90%] md:hidden
        bg-white rounded-3xl shadow-2xl p-6 transition-all duration-300 origin-top
        border border-[#B5E3D4]
        ${menuOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}
      `}>
        <div className="flex flex-col gap-6 text-center">
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-gray-100 p-3 rounded-2xl text-sm"
          />
          {user ? (
            <> 
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="text-emerald-900 font-bold">Panel</Link>
              <button onClick={handleLogout} className="text-red-500 font-medium">Cerrar Sesión</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="text-emerald-900 font-bold">Ingresar</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="bg-[#B5E3D4] text-emerald-900 py-3 rounded-full font-bold">Registrarse</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}