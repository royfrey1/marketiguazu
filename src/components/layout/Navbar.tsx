import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import useCart from '../../hooks/useCart'
import CategoryMegaMenu from './CategoryMegaMenu'
import logo from '../../assets/images/iguazu1.png'
import { ShoppingCart, User, Search, Menu, X, LogOut, ChevronDown } from 'lucide-react'

export default function NavBar() {
  const { user, loading, signOut } = useAuth()
  const { itemCount } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [desktopOpen, setDesktopOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close desktop dropdown on route change
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname
      setDesktopOpen(false)
    }
  }, [location.pathname])

  // Close on Escape
  useEffect(() => {
    if (!desktopOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDesktopOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [desktopOpen])

  // Lock body scroll when any menu is open
  useEffect(() => {
    if (!desktopOpen && !menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [desktopOpen, menuOpen])

  const handleLogout = async () => {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  if (location.pathname === '/login' || location.pathname === '/register') {
    const isLogin = location.pathname === '/login'
    return (
      <header className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link to="/" className="flex-shrink-0">
            <img src={logo} alt="Logo" className="h-10 md:h-12 w-auto object-contain" />
          </Link>
          <Link
            to={isLogin ? "/register" : "/login"}
            className="bg-accent hover:bg-accent/90 text-white font-bold text-xs md:text-sm px-4 py-2 md:px-6 md:py-2.5 rounded-lg transition-all"
          >
            {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className="relative sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm transition-all duration-300">
      <div className={`
        max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 transition-all duration-300
        ${isScrolled ? 'py-2' : 'py-3'}
      `}>
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <img
            src={logo}
            alt="Iguazú Marketplace"
            className={`transition-all duration-500 object-contain ${
              isScrolled ? 'h-11 md:h-12' : 'h-14 md:h-18'
            }`}
          />
        </Link>

        {/* Categorías - Desktop */}
        <div className="hidden lg:flex items-center gap-1 ml-8 relative">
          <button
            onClick={() => setDesktopOpen(!desktopOpen)}
            data-category-toggle
            className={`flex items-center gap-1.5 text-sm font-bold transition-all duration-200 px-3 py-2 rounded-lg ${
              desktopOpen
                ? 'text-accent bg-accent/5'
                : 'text-primary-dark hover:text-accent hover:bg-primary-light/15'
            }`}
            aria-haspopup="true"
            aria-expanded={desktopOpen}
          >
            Categorías
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${desktopOpen ? 'rotate-180' : ''}`} />
          </button>
          <CategoryMegaMenu
            mode="desktop"
            isOpen={desktopOpen}
            onClose={() => setDesktopOpen(false)}
          />
        </div>

        {/* Buscador - Desktop */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-6 relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`)}
            placeholder="Buscar productos, marcas y más..."
            className="w-full rounded-lg pl-4 pr-12 py-3 text-sm outline-none bg-gray-50 text-primary-dark placeholder:text-gray-400 border border-gray-200 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20 transition-all"
          />
          <button
            onClick={() => navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`)}
            className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-white p-2.5 rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Carrito */}
          <Link
            to="/carrito"
            className="relative flex items-center justify-center p-2.5 rounded-lg text-primary-dark hover:bg-primary-light/15 transition-colors"
            aria-label={`Carrito (${itemCount} productos)`}
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          {/* Cuenta - Desktop */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? null : user ? (
              <>
                <Link
                  to="/perfil"
                  className="flex items-center gap-2 text-sm font-bold text-primary-dark px-3 py-2 rounded-lg hover:bg-primary-light/15 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Mi cuenta
                </Link>
                <button
                  onClick={handleLogout}
                  className="cursor-pointer flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link
                to="/register"
                className="bg-accent hover:bg-accent/90 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>

          {/* Menú Mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2.5 rounded-lg text-primary-dark hover:bg-primary-light/15 transition-colors"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menú Mobile */}
      <div className={`
        lg:hidden overflow-hidden transition-all duration-300 origin-top
        ${menuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="px-4 pb-4 border-t border-gray-100 max-h-[calc(80vh-60px)] overflow-y-auto">
          {/* Buscador Mobile */}
          <div className="relative mt-3 mb-4">
            <input
              type="text"
              placeholder="¿Qué buscás hoy?"
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-lg text-sm outline-none text-primary-dark focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`)}
            />
            <button
              onClick={() => { navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`); setMenuOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-white p-2 rounded-lg"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Categorías Mobile */}
          <div className="mb-3">
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Categorías</span>
            </div>
            <CategoryMegaMenu
              mode="mobile"
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
            />
          </div>

          {!loading && user ? (
            <div className="space-y-2">
              <Link to="/perfil" onClick={() => setMenuOpen(false)} className="block bg-primary-light/15 text-primary-dark p-3 rounded-lg text-center font-bold text-sm">
                Mi Perfil
              </Link>
              <Link to="/carrito" onClick={() => setMenuOpen(false)} className="block bg-primary-light/15 text-primary-dark p-3 rounded-lg text-center font-bold text-sm relative">
                Carrito
                {itemCount > 0 && (
                  <span className="absolute top-2 right-4 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
              <button onClick={handleLogout} className="w-full text-red-500 font-bold py-3 rounded-lg hover:bg-red-50 transition-colors">
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link to="/carrito" onClick={() => setMenuOpen(false)} className="block bg-primary-light/15 text-primary-dark p-3 rounded-lg text-center font-bold text-sm relative">
                Carrito
                {itemCount > 0 && (
                  <span className="absolute top-2 right-4 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
              {!loading && (
                <Link to="/register" onClick={() => setMenuOpen(false)} className="block bg-accent text-white py-3 rounded-lg text-center font-bold">
                  Iniciar Sesión
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
