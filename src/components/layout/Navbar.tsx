import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import useCart from '../../hooks/useCart'
import CategoryMegaMenu from './CategoryMegaMenu'
import logo from '../../assets/images/iguazu1.png'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ShoppingCart, User, Search, Menu, X, LogOut, ChevronDown, LayoutGrid } from 'lucide-react'

const MOBILE_MENU_ID = 'mobile-menu'
const MOBILE_CATEGORIES_ID = 'mobile-menu-categories'
// Filas y botones del menú mobile: target táctil de al menos 44 px
const MOBILE_ROW = 'flex items-center gap-3 w-full min-h-11 px-3 rounded-lg text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

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
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  // Borde inferior del header en la ventana: el panel mobile ocupa el resto (con dvh)
  const [headerBottom, setHeaderBottom] = useState(0)
  const reduceMotion = useReducedMotion()

  // Cerrar el menú mobile siempre vuelve a colapsar Categorías
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    setCategoriesOpen(false)
  }, [])

  const measureHeaderBottom = () => Math.max(0, Math.round(headerRef.current?.getBoundingClientRect().bottom ?? 0))

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu()
      return
    }
    setHeaderBottom(measureHeaderBottom())
    setMenuOpen(true)
  }

  const goToSearch = () => {
    navigate(`/busqueda?q=${encodeURIComponent(busqueda)}`)
    closeMenu()
  }

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
      setMenuOpen(false)
      setCategoriesOpen(false)
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

  // Mobile menu: Escape cierra y devuelve el foco a la hamburguesa
  useEffect(() => {
    if (!menuOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      closeMenu()
      menuButtonRef.current?.focus()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [menuOpen, closeMenu])

  // Mobile menu: si la pantalla pasa a >=lg se cierra (y se libera el scroll del body);
  // si cambia el alto de la ventana con el menú abierto, se recalcula dónde termina el header
  useEffect(() => {
    if (!menuOpen) return
    const mql = window.matchMedia('(min-width: 1024px)')
    const handleBreakpoint = (e: MediaQueryListEvent) => { if (e.matches) closeMenu() }
    const handleResize = () => setHeaderBottom(Math.max(0, Math.round(headerRef.current?.getBoundingClientRect().bottom ?? 0)))
    mql.addEventListener('change', handleBreakpoint)
    window.addEventListener('resize', handleResize)
    return () => {
      mql.removeEventListener('change', handleBreakpoint)
      window.removeEventListener('resize', handleResize)
    }
  }, [menuOpen, closeMenu])

  // Lock body scroll when any menu is open
  useEffect(() => {
    if (!desktopOpen && !menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [desktopOpen, menuOpen])

  const handleLogout = async () => {
    await signOut()
    closeMenu()
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

  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2 }

  return (
    <>
    {/* Overlay del menú mobile: queda detrás del header (z-50) y del panel; tocarlo cierra */}
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          key="mobile-menu-overlay"
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
    <header ref={headerRef} className="relative sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm transition-all duration-300">
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
                to="/login"
                className="bg-accent hover:bg-accent/90 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>

          {/* Menú Mobile */}
          <button
            ref={menuButtonRef}
            onClick={toggleMenu}
            className="lg:hidden p-2.5 rounded-lg text-primary-dark hover:bg-primary-light/15 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menú Mobile: panel debajo del header, alto máximo = resto de la ventana (dvh), un solo scroll */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu-panel"
            id={MOBILE_MENU_ID}
            className="lg:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-100 shadow-lg overflow-y-auto overscroll-contain max-h-[calc(100vh-var(--nav-bottom))] supports-[height:100dvh]:max-h-[calc(100dvh-var(--nav-bottom))]"
            style={{ '--nav-bottom': `${headerBottom}px` } as React.CSSProperties}
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={fade}
          >
            <div className="px-4 pt-3 pb-4 space-y-3">
              {/* Buscador */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="¿Qué buscás hoy?"
                  aria-label="Buscar productos"
                  className="w-full h-12 bg-gray-50 border border-gray-200 pl-3 pr-14 rounded-lg text-sm outline-none text-primary-dark focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goToSearch()}
                />
                <button
                  onClick={goToSearch}
                  aria-label="Buscar"
                  className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center bg-accent text-white rounded-r-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Cuenta (mientras carga la sesión no se muestra) */}
              {!loading && (user ? (
                <Link to="/perfil" onClick={closeMenu} className={`${MOBILE_ROW} bg-primary-light/15 text-primary-dark hover:bg-primary-light/25`}>
                  <User className="w-4 h-4" />
                  Mi perfil
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" onClick={closeMenu} className={`${MOBILE_ROW} justify-center bg-accent text-white hover:bg-accent/90`}>
                    Iniciar sesión
                  </Link>
                  <Link to="/register" onClick={closeMenu} className={`${MOBILE_ROW} justify-center border border-accent text-accent hover:bg-accent/5`}>
                    Crear cuenta
                  </Link>
                </div>
              ))}

              {/* Categorías: colapsada por defecto */}
              <div>
                <button
                  type="button"
                  onClick={() => setCategoriesOpen(open => !open)}
                  aria-expanded={categoriesOpen}
                  aria-controls={MOBILE_CATEGORIES_ID}
                  className={`${MOBILE_ROW} text-primary-dark hover:bg-gray-50`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="flex-1 text-left">Categorías</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${categoriesOpen ? 'rotate-180' : ''}`} />
                </button>
                <motion.div
                  id={MOBILE_CATEGORIES_ID}
                  initial={false}
                  animate={{ height: categoriesOpen ? 'auto' : 0, opacity: categoriesOpen ? 1 : 0 }}
                  transition={fade}
                  className="overflow-hidden"
                  inert={!categoriesOpen}
                >
                  <div className="pt-1 pl-2">
                    <CategoryMegaMenu
                      mode="mobile"
                      isOpen={menuOpen}
                      onClose={closeMenu}
                    />
                  </div>
                </motion.div>
              </div>

              {/* Cerrar sesión */}
              {!loading && user && (
                <div className="pt-3 border-t border-gray-100">
                  <button onClick={handleLogout} className={`${MOBILE_ROW} text-red-500 hover:bg-red-50`}>
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  )
}
