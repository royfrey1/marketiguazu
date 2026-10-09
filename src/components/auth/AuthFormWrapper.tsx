import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, ShieldCheck, Headphones } from 'lucide-react'
import logo from '../../assets/images/iguazu1.png'

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

interface AuthFormWrapperProps {
  children: ReactNode
}

const panelEase = [0.22, 1, 0.36, 1] as const
const panelDuration = 0.55
const contentCrossfade = 0.3
const mobileCrossfade = 0.35

export default function AuthFormWrapper({ children }: AuthFormWrapperProps) {
  const { pathname } = useLocation()
  const isLogin = pathname === '/login' || pathname === '/reset-password'
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return isDesktop ? (
    <DesktopSwitch isLogin={isLogin} pathname={pathname}>
      {children}
    </DesktopSwitch>
  ) : (
    <MobileSwitch isLogin={isLogin} pathname={pathname}>
      {children}
    </MobileSwitch>
  )
}

/* ─── Desktop (≥1024) — state-driven panel swap ─── */

function DesktopSwitch({
  children,
  isLogin,
  pathname,
}: {
  children: ReactNode
  isLogin: boolean
  pathname: string
}) {
  return (
    <div className="relative h-screen overflow-hidden hidden lg:block">
      {/* ── Green identity panel (z-10) ── */}
      <motion.div
        className="absolute top-0 left-0 w-1/2 h-full z-10"
        animate={{ x: isLogin ? '0%' : '100%', opacity: isLogin ? 1 : 0.95 }}
        transition={{ duration: panelDuration, ease: panelEase }}
      >
        <div className="relative h-full bg-primary-dark flex flex-col justify-between p-14">
          <div className="absolute inset-0 opacity-[0.04]">
            <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-accent" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary-light" />
          </div>

          <div className="relative z-10">
            <Link to="/" className="inline-block mb-16">
              <img src={logo} alt="Iguazú Marketplace" className="h-28 w-auto object-contain" />
            </Link>

            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'bl' : 'br'}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: contentCrossfade }}
              >
                <h2 className="text-white text-3xl xl:text-4xl font-black leading-tight mb-4">
                  {isLogin ? (
                    <>El marketplace<br />de Iguazú</>
                  ) : (
                    <>Bienvenido a<br />Iguazú</>
                  )}
                </h2>
                <p className="text-primary-light/70 text-sm max-w-xs leading-relaxed">
                  {isLogin
                    ? 'Comprá tecnología con confianza. Envíos a todo el país y atención personalizada.'
                    : 'Creá tu cuenta y empezá a comprar en el marketplace más completo de la región.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3 text-primary-light/50">
              <Truck className="w-4 h-4" />
              <span className="text-xs">Envíos a todo el país</span>
            </div>
            <div className="flex items-center gap-3 text-primary-light/50">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs">Compra segura</span>
            </div>
            <div className="flex items-center gap-3 text-primary-light/50">
              <Headphones className="w-4 h-4" />
              <span className="text-xs">Atención personalizada</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── White form panel (z-20, always on top for interactivity) ──
          Scroll propio: si el formulario no entra en el alto de la ventana se scrollea
          en vez de recortarse. El centrado vertical va en el wrapper interno (min-h-full),
          no en el panel con overflow, para no cortar el principio del contenido. */}
      <motion.div
        data-scroll-container
        className="absolute top-0 left-1/2 w-1/2 h-full bg-white z-20 overflow-y-auto px-16 xl:px-20"
        animate={{ x: isLogin ? '0%' : '-100%', opacity: isLogin ? 0.95 : 1 }}
        transition={{ duration: panelDuration, ease: panelEase }}
      >
        <div className="min-h-full flex items-center justify-center py-8">
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: contentCrossfade }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── Mobile (<1024) — fixed panels, coordinated content crossfade ─── */

function MobileSwitch({
  children,
  isLogin,
  pathname,
}: {
  children: ReactNode
  isLogin: boolean
  pathname: string
}) {
  return (
    <div className="relative min-h-screen overflow-hidden lg:hidden flex flex-col">
      {/* ── Green panel — always on top, fixed position ── */}
      <div className="shrink-0 bg-primary-dark px-6 py-10 relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-primary-dark"
          animate={{ opacity: isLogin ? 0 : 0.08 }}
          transition={{ duration: mobileCrossfade }}
        />

        <Link to="/" className="inline-block relative z-10">
          <img src={logo} alt="Iguazú Marketplace" className="h-11 w-auto object-contain" />
        </Link>

        <div className="relative z-10 mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'bl' : 'br'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <p className="text-primary-light/60 text-xs leading-relaxed">
                {isLogin
                  ? 'Comprá tecnología con confianza.'
                  : 'Creá tu cuenta y empezá a comprar.'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── White form panel — always on bottom, fixed position ── */}
      <div className="flex-1 bg-white flex flex-col items-stretch justify-start px-6 pt-8 pb-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
