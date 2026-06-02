import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import logo from '../assets/iguazu1.png'
import logosolo from '../assets/logosolo.png'
import { useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faRocket, faSignOutAlt, faUserGear, faDollarSign  } from '@fortawesome/free-solid-svg-icons'

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
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center p-2 md:p-4 transition-all duration-500">
      <nav className={`
        flex items-center justify-between px-4 md:px-6 transition-all duration-500
        rounded-full border-2 border-[#B5E3D4] gap-2
        ${isScrolled 
          ? 'w-[98%] lg:w-[90%] bg-[#B5E3D4]/95 backdrop-blur-md shadow-2xl py-1.5' 
          : 'w-full bg-[#B5E3D4]/50 backdrop-blur-sm shadow-none py-2 md:py-3'
        }
      `}>
        
        {/* LOGO - Responsivo para no chocar */}
        <Link to="/" className="flex-shrink-0">
          <img 
            src={logo} 
            alt="Logo" 
            className={`transition-all duration-300 object-contain ${
              isScrolled ? 'h-10 md:h-14' : 'h-14 md:h-20'
            }`} 
          />
        </Link>

        {/* BUSCADOR - Se oculta en tablets/móviles para que no explote el espacio */}
        <div className="hidden lg:flex flex-1 max-w-md mx-4 relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`)}
            placeholder="Buscar productos..."
            className={`w-full rounded-full px-6 py-3 text-sm outline-none transition-all ${
              isScrolled ? 'bg-white text-emerald-900 shadow-inner' : 'bg-white/30 text-white placeholder:text-black/40 border border-emerald-900/20'
            }`}
          />
          <button 
            onClick={() => navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`)}
            className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 bg-[#1CAAA8] text-white text-md font-bold px-4 py-2 rounded-full hover:brightness-110"
          >
            Buscar
          </button>
        </div>

        {/* ACCIONES */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {/* Quiero Vender - Texto oculto en tablets, icono siempre visible */}
                <Link to="/dashboard" className={`flex items-center gap-2 font-bold bg-[#1CAAA8] p-2.5 md:px-5 md:py-2 rounded-full transition-all hover:brightness-110 border border-[#185749]/20 ${isScrolled ? 'text-emerald-900' : 'text-white'}`}>
                  <FontAwesomeIcon icon={faDollarSign} />
                  <span className="hidden lg:inline">Quiero Vender</span>
                </Link>

                {/* Perfil - Texto oculto en tablets */}
                <Link to="/miperfil" className={`flex items-center gap-2 font-bold bg-[#1CAAA8] p-2.5 md:px-5 md:py-2 rounded-full transition-all hover:brightness-110 border border-[#185749]/20 ${isScrolled ? 'text-emerald-900' : 'text-white'}`}>
                  <FontAwesomeIcon icon={faUserGear} />
                  <span className="hidden lg:inline">Perfil</span>
                </Link>

                {/* Salir - Texto siempre oculto en pantallas medianas */}
                <button onClick={handleLogout} className="cursor-pointer flex items-center gap-2 bg-white/50 p-2.5 md:px-5 md:py-2 rounded-full font-bold hover:bg-red-500 hover:text-white transition-all">
                  <FontAwesomeIcon icon={faSignOutAlt} className="text-red-600 group-hover:text-white" />
                  <span className="hidden lg:inline">Salir</span>
                </button>
              </>
            ) : (
              <Link to="/register" className="bg-[#B5E3D4] px-6 py-2 rounded-full font-bold text-emerald-900 shadow-md">
                Ingresar
              </Link>
            )}
          </div>

          {/* Menú Mobile Button - Visible en menos de LG */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden p-2 w-10 h-10 rounded-full flex items-center justify-center bg-white/20 ${isScrolled ? 'text-emerald-900' : 'text-white'}`}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Menú Mobile - Ahora también incluye el buscador que ocultamos arriba */}
      <div className={`
        absolute top-24 left-1/2 -translate-x-1/2 w-[92%] lg:hidden
        bg-white rounded-[2rem] shadow-2xl p-6 transition-all duration-300 origin-top border border-[#B5E3D4]
        ${menuOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}
      `}>
        <div className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="¿Qué buscás hoy?"
              className="w-full bg-gray-100 p-4 rounded-2xl text-sm outline-none"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button onClick={() => { navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`); setMenuOpen(false); }} className="absolute right-2 top-2 bg-[#1CAAA8] text-white px-4 py-2 rounded-xl text-xs">Buscar</button>
          </div>
          {user ? (
            <div className="grid grid-cols-2 gap-2">
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="bg-emerald-50 text-emerald-900 p-4 rounded-2xl text-center font-bold text-sm">Vender 🚀</Link>
              <Link to="/miperfil" onClick={() => setMenuOpen(false)} className="bg-gray-50 text-gray-700 p-4 rounded-2xl text-center font-bold text-sm">Mi Perfil</Link>
              <button onClick={handleLogout} className="col-span-2 text-red-500 font-bold py-2">Cerrar Sesión</button>
            </div>
          ) : (
            <Link to="/register" onClick={() => setMenuOpen(false)} className="bg-[#B5E3D4] text-emerald-900 py-4 rounded-2xl text-center font-bold">Iniciar Sesión</Link>
          )}
        </div>
      </div>
    </header>
  )
}