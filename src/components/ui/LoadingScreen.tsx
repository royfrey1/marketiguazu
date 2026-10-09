import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import logo from '../../assets/images/iguazu1.png'

type Tone = 'light' | 'dark'

interface ScreenShellProps {
  tone: Tone
  /** fullscreen: rutas protegidas/admin. page: carga de una página de la tienda (no ocupa toda la ventana) */
  variant: 'fullscreen' | 'page'
  children: ReactNode
}

// Mismos fondos que la tienda (blanco) y que AdminLayout en claro/oscuro
function ScreenShell({ tone, variant, children }: ScreenShellProps) {
  const background = variant === 'page' ? 'bg-white' : tone === 'dark' ? 'bg-[#0F1A17]' : 'bg-[#F7F8FA]'
  const height = variant === 'page' ? 'min-h-[60vh]' : 'min-h-screen'
  return (
    <div className={`${height} ${background} flex items-center justify-center px-4`}>
      <div className="flex flex-col items-center text-center">
        {/* El logo tiene verdes oscuros: sobre el fondo oscuro del admin va sobre una placa clara */}
        <div className={`mb-6 ${tone === 'dark' && variant === 'fullscreen' ? 'rounded-2xl bg-white px-4 py-3' : ''}`}>
          <img src={logo} alt="Iguazú Marketplace" className="h-14 w-auto object-contain" />
        </div>
        {children}
      </div>
    </div>
  )
}

interface LoadingScreenProps {
  /** Texto visible y anunciado por lectores de pantalla */
  label?: string
  variant?: 'fullscreen' | 'page'
  tone?: Tone
  /** Espera antes de mostrarse, para que las cargas rápidas no generen un destello */
  delayMs?: number
}

export default function LoadingScreen({ label = 'Cargando...', variant = 'fullscreen', tone = 'light', delayMs = 0 }: LoadingScreenProps) {
  const [visible, setVisible] = useState(delayMs === 0)

  useEffect(() => {
    if (delayMs === 0) return
    const t = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs])

  if (!visible) {
    // Reserva el espacio sin mostrar nada mientras dura la espera
    return <div className={variant === 'page' ? 'min-h-[60vh]' : 'min-h-screen'} aria-hidden="true" />
  }

  const ring = tone === 'dark' ? 'border-white/15 border-t-accent' : 'border-primary-light border-t-accent'
  const text = tone === 'dark' && variant === 'fullscreen' ? 'text-white/80' : 'text-primary-dark/70'

  return (
    <ScreenShell tone={tone} variant={variant}>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
        {/* Con reduced motion el indicador queda estático */}
        <span className={`w-8 h-8 rounded-full border-[3px] ${ring} animate-spin motion-reduce:animate-none`} aria-hidden="true" />
        <p className={`text-sm font-medium ${text}`}>{label}</p>
      </div>
    </ScreenShell>
  )
}

interface ErrorScreenProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  tone?: Tone
}

export function ErrorScreen({ title, description, actionLabel, onAction, tone = 'light' }: ErrorScreenProps) {
  const titleColor = tone === 'dark' ? 'text-white' : 'text-primary-dark'
  const descColor = tone === 'dark' ? 'text-white/60' : 'text-gray-500'
  return (
    <ScreenShell tone={tone} variant="fullscreen">
      <div role="alert" className="flex flex-col items-center max-w-sm">
        <span className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4" aria-hidden="true">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </span>
        <p className={`text-lg font-bold ${titleColor}`}>{title}</p>
        <p className={`text-sm mt-1.5 ${descColor}`}>{description}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-6 min-h-11 px-6 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {actionLabel}
        </button>
      </div>
    </ScreenShell>
  )
}
