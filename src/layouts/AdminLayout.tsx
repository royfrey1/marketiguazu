import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import Seo from '../components/seo/Seo'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, Tag, ClipboardList,
  ChevronLeft, ChevronRight, LogOut, ExternalLink, Menu,
  Search, Moon, Sun, Bell, X, RotateCcw,
} from 'lucide-react'
import useAuth from '../hooks/useAuth'
import { withdrawalService } from '../services/withdrawal.service'
import { WITHDRAWALS_CHANGED_EVENT } from '../types/withdrawal'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/admin/categorias', label: 'Categorías', icon: Tag },
  { to: '/admin/inventario', label: 'Inventario', icon: ClipboardList },
  { to: '/admin/arrepentimientos', label: 'Arrepentimientos', icon: RotateCcw },
] as const

const WITHDRAWALS_PATH = '/admin/arrepentimientos'

const SIDEBAR_WIDTH = 256
const SIDEBAR_COLLAPSED_WIDTH = 72
const SIDEBAR_STORAGE_KEY = 'admin.sidebar.collapsed'

// ---------------------------------------------------------------------------
// Hook: click-outside
// ---------------------------------------------------------------------------

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [ref, handler, active])
}

// ---------------------------------------------------------------------------
// AdminLayout
// ---------------------------------------------------------------------------

export default function AdminLayout({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { profile, user, signOut } = useAuth()
  const location = useLocation()

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed)) } catch { /* noop */ }
  }, [collapsed])

  useEffect(() => {
    startTransition(() => { setMobileOpen(false) })
  }, [location.pathname])

  const toggleCollapse = useCallback(() => setCollapsed(prev => !prev), [])

  // Solicitudes de arrepentimiento sin atender (status received). Si la consulta
  // falla queda en null y el menú no muestra contador.
  const [openWithdrawals, setOpenWithdrawals] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = () => {
      withdrawalService.countOpenWithdrawalsAdmin()
        .then(({ count }) => { if (!cancelled) setOpenWithdrawals(count) })
        .catch(() => { if (!cancelled) setOpenWithdrawals(null) })
    }
    load()
    window.addEventListener(WITHDRAWALS_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(WITHDRAWALS_CHANGED_EVENT, load)
    }
  }, [location.pathname])

  const isActive = (to: string) => {
    if (to === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(to)
  }

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  // ── Theme ────────────────────────────────────────────────────────────────

  // dark state and toggleTheme are provided by App.tsx

  // ── Notifications + Search ───────────────────────────────────────────────

  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const closeNotif = useCallback(() => setNotifOpen(false), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useClickOutside(notifRef, closeNotif, notifOpen)

  useEffect(() => {
    if (!notifOpen && !searchOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeNotif(); closeSearch() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [notifOpen, searchOpen, closeNotif, closeSearch])

  useEffect(() => {
    if (!mobileOpen) return
    startTransition(() => { closeNotif() })
  }, [mobileOpen, closeNotif])

  useEffect(() => { startTransition(() => { closeNotif(); closeSearch() }) }, [location.pathname, closeNotif, closeSearch])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  // ── User helpers ─────────────────────────────────────────────────────────

  const userName = profile?.nombre || user?.email?.split('@')[0] || 'Admin'
  const userEmail = user?.email || ''
  const userRole = profile?.role === 'admin' ? 'Administrador' : 'Usuario'
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // ── Sidebar shared classes ───────────────────────────────────────────────

  const sidebarBg = 'bg-[#0D3732] dark:bg-[#0B1613]'
  const sidebarBorder = 'border-white/10 dark:border-white/5'
  const navActive = 'bg-white/10 dark:bg-white/5 text-white'
  const navInactive = 'text-white/60 hover:bg-white/5 hover:text-white dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/90'
  const sidebarAction = 'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition-colors duration-150 cursor-pointer'

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-200 ${dark ? 'dark bg-[#0F1A17]' : 'bg-[#F7F8FA]'}`}>
      <Seo noindex />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          ${sidebarBg} text-white
          transition-[width] duration-250 ease-in-out
          lg:static lg:z-auto
          lg:transition-[width] lg:duration-250 lg:ease-in-out
          ${mobileOpen
            ? 'translate-x-0 transition-transform duration-250 ease-in-out'
            : '-translate-x-full transition-transform duration-250 ease-in-out lg:translate-x-0'
          }
        `}
        style={{ width: mobileOpen ? SIDEBAR_WIDTH : sidebarWidth }}
      >
        {/* Logo */}
        <div
          className={`flex items-center h-16 px-4 border-b ${sidebarBorder} flex-shrink-0 overflow-hidden`}
          style={{ paddingLeft: collapsed ? 0 : 16, justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          {!collapsed && (
            <span className="text-sm font-black tracking-tight text-white whitespace-nowrap">
              IGUAZÚ ADMIN
            </span>
          )}
          {collapsed && (
            <span className="text-xs font-black text-white">IG</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" role="navigation" aria-label="Navegación administrativa">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`
                  group relative flex items-center gap-3 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  ${active ? navActive : navInactive}
                `}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#1CAAA8] rounded-r-full" />
                )}
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-[#1CAAA8]' : ''}`} />
                {!collapsed && <span>{item.label}</span>}
                {item.to === WITHDRAWALS_PATH && openWithdrawals != null && openWithdrawals > 0 && (
                  <span
                    className={`min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-[#0D3732] text-[10px] font-black leading-5 text-center ${
                      collapsed ? 'absolute top-0.5 right-0.5 min-w-4 h-4 leading-4 px-1' : 'ml-auto'
                    }`}
                    aria-label={`${openWithdrawals} sin atender`}
                  >
                    {openWithdrawals > 99 ? '99+' : openWithdrawals}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Bottom section ──────────────────────────────────────────────── */}
        <div className={`border-t ${sidebarBorder} flex-shrink-0 overflow-hidden ${collapsed ? 'px-2 py-3' : 'p-3'}`}>

          {/* User profile — always visible */}
          <Link
            to="/admin/cuenta"
            onClick={() => setMobileOpen(false)}
            className={`
              group flex items-center gap-3 rounded-lg transition-colors duration-150
              hover:bg-white/5 dark:hover:bg-white/5
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1CAAA8]
              ${collapsed ? 'flex-col justify-center px-2 py-2' : 'px-3 py-2.5'}
            `}
            title={collapsed ? userName : undefined}
            aria-label={`Mi cuenta: ${userName}`}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={userName}
                className={`${collapsed ? 'w-8 h-8' : 'w-9 h-9'} rounded-full object-cover flex-shrink-0`}
              />
            ) : (
              <div className={`${collapsed ? 'w-8 h-8' : 'w-9 h-9'} rounded-full bg-[#1CAAA8] flex items-center justify-center flex-shrink-0`}>
                <span className={`${collapsed ? 'text-[10px]' : 'text-xs'} font-bold text-white`}>{initials}</span>
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{userName}</p>
                {userEmail && (
                  <p className="text-[11px] text-white/40 truncate">{userEmail}</p>
                )}
                <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#1CAAA8]/15 text-[#1CAAA8]">
                  {userRole}
                </span>
              </div>
            )}
          </Link>

          {/* Divider */}
          <div className={`border-t ${sidebarBorder} my-2`} />

          {/* Volver a la tienda — always visible */}
          <Link
            to="/"
            className={`${sidebarAction} ${collapsed ? 'justify-center px-2' : ''}`}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Volver a la tienda' : undefined}
          >
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Volver a la tienda</span>}
          </Link>

          {/* Cerrar sesión — always visible */}
          <button
            onClick={() => signOut()}
            className={`
              flex items-center gap-2 w-full rounded-lg text-sm font-medium
              text-white/50 hover:text-white hover:bg-white/5
              transition-colors duration-150 cursor-pointer mt-1
              ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
            `}
            title={collapsed ? 'Cerrar sesión' : undefined}
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Top Navbar ─────────────────────────────────────────────────── */}
        <header className={`
          flex items-center h-14 px-4 sm:px-6 flex-shrink-0
          border-b transition-colors duration-200
          ${dark
            ? 'bg-[#131F1C] border-white/5'
            : 'bg-white border-gray-200'
          }
        `}>

          {/* ── Left group: toggle + search ──────────────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">

            {/* Sidebar toggle: mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className={`
                lg:hidden p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0
                ${dark
                  ? 'text-white/50 hover:text-white hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }
              `}
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Sidebar toggle: desktop */}
            <button
              onClick={toggleCollapse}
              className={`
                hidden lg:flex p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0
                ${dark
                  ? 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }
              `}
              aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Search: icon on mobile (opens expandable), full bar on tablet+ */}
            <button
              onClick={() => setSearchOpen(v => !v)}
              className={`
                sm:hidden p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0
                ${searchOpen
                  ? dark
                    ? 'text-[#1CAAA8] bg-white/10'
                    : 'text-[#185749] bg-gray-200'
                  : dark
                    ? 'text-white/40 hover:text-[#1CAAA8] hover:bg-white/5'
                    : 'text-gray-400 hover:text-[#185749] hover:bg-gray-100'
                }
              `}
              aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar'}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>

            <div className="hidden sm:block flex-1 max-w-md">
              <div className={`
                relative flex items-center rounded-lg transition-colors
                ${dark
                  ? 'bg-white/5 focus-within:bg-white/10'
                  : 'bg-gray-100 focus-within:bg-gray-200/70'
                }
              `}>
                <Search className={`absolute left-3 w-4 h-4 pointer-events-none ${dark ? 'text-white/30' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Buscar o escribir un comando..."
                  readOnly
                  className={`
                    w-full py-2 pl-9 pr-16 text-sm rounded-lg
                    bg-transparent outline-none cursor-default
                    placeholder:select-none
                    ${dark
                      ? 'text-white/80 placeholder:text-white/30'
                      : 'text-gray-700 placeholder:text-gray-400'
                    }
                  `}
                  aria-label="Buscar"
                />
                <kbd className={`
                  absolute right-2.5 hidden md:inline-flex items-center gap-0.5
                  px-1.5 py-0.5 rounded text-[10px] font-medium
                  ${dark
                    ? 'bg-white/10 text-white/30'
                    : 'bg-gray-200 text-gray-400'
                  }
                `}>
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>

          {/* ── Right controls: theme + notifications ─────────────────────── */}
          <div className="flex items-center gap-1.5 sm:gap-3 ml-2 sm:ml-4 flex-shrink-0">

            {/* Theme toggle */}
            <button
              onClick={onToggleTheme}
              className={`
                p-2 rounded-lg transition-colors cursor-pointer
                ${dark
                  ? 'text-white/40 hover:text-[#1CAAA8] hover:bg-white/5'
                  : 'text-gray-400 hover:text-[#185749] hover:bg-gray-100'
                }
              `}
              aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className={`
                  relative p-2 rounded-lg transition-colors cursor-pointer
                  ${dark
                    ? 'text-white/40 hover:text-[#1CAAA8] hover:bg-white/5'
                    : 'text-gray-400 hover:text-[#185749] hover:bg-gray-100'
                  }
                `}
                aria-label="Notificaciones"
                aria-expanded={notifOpen}
                aria-haspopup="true"
              >
                <Bell className="w-[18px] h-[18px]" />
              </button>
              {notifOpen && (
                <div
                  className={`
                    absolute right-0 sm:right-3 top-full mt-2 w-[min(20rem,calc(100vw-24px))] rounded-xl shadow-xl border
                    z-50 overflow-hidden
                    ${dark
                      ? 'bg-[#1A2B27] border-white/10'
                      : 'bg-white border-gray-200'
                    }
                  `}
                  role="menu"
                  aria-label="Notificaciones"
                >
                  <div className={`px-4 py-3 border-b ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                    <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Notificaciones</h3>
                  </div>
                  <div className="px-4 py-10 text-center">
                    <Bell className={`w-8 h-8 mx-auto mb-2 ${dark ? 'text-white/15' : 'text-gray-200'}`} />
                    <p className={`text-sm ${dark ? 'text-white/30' : 'text-gray-400'}`}>No hay notificaciones</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Mobile search row (expandable) ─────────────────────────────── */}
        <div
          className={`
            sm:hidden overflow-hidden border-b transition-all duration-200 ease-in-out
            ${searchOpen ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0 border-b-transparent'}
            ${dark
              ? 'bg-[#131F1C] border-white/5'
              : 'bg-white border-gray-200'
            }
          `}
        >
          <div className="px-4 py-2.5">
            <div className={`
              relative flex items-center rounded-lg transition-colors
              ${dark
                ? 'bg-white/5 focus-within:bg-white/10'
                : 'bg-gray-100 focus-within:bg-gray-200/70'
              }
            `}>
              <Search className={`absolute left-3 w-4 h-4 pointer-events-none ${dark ? 'text-white/30' : 'text-gray-400'}`} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar o escribir un comando..."
                readOnly
                className={`
                  w-full py-2 pl-9 pr-10 text-sm rounded-lg
                  bg-transparent outline-none cursor-default
                  placeholder:select-none
                  ${dark
                    ? 'text-white/80 placeholder:text-white/30'
                    : 'text-gray-700 placeholder:text-gray-400'
                  }
                `}
                aria-label="Buscar"
              />
              <button
                onClick={closeSearch}
                className={`
                  absolute right-2 p-1 rounded-md transition-colors cursor-pointer
                  ${dark
                    ? 'text-white/30 hover:text-white/60 hover:bg-white/5'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                  }
                `}
                aria-label="Cerrar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Page content ──────────────────────────────────────────────── */}
        <main className={`
          flex-1 min-h-0 overflow-auto transition-colors duration-200
          ${dark ? 'bg-[#0F1A17]' : 'bg-[#F7F8FA]'}
        `}>
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
