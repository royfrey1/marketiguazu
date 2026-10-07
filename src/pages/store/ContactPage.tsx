import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MapPin, Truck, Copy, Check, Flag, RotateCcw, ShieldCheck, ArrowRight, Info } from 'lucide-react'
import { LEGAL } from '../../config/legal'
import { whatsappUrl } from '../../lib/whatsapp'

// Mismo ícono que el botón flotante de WhatsApp (StorefrontFloatingActions)
function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function ContactCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">{icon}</span>
        <h2 className="text-base font-bold text-primary-dark">{title}</h2>
      </div>
      {children}
    </section>
  )
}

const HELP_LINKS = [
  { to: '/report', label: 'Reportar un problema', icon: Flag },
  { to: '/devoluciones', label: 'Garantías, cambios y devoluciones', icon: ShieldCheck },
  { to: '/arrepentimiento', label: 'Botón de arrepentimiento', icon: RotateCcw },
]

export default function ContactPage() {
  const [copied, setCopied] = useState(false)

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(LEGAL.EMAIL_CONTACTO)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin acceso al portapapeles: el email sigue visible para copiarlo a mano
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="store-container py-8 sm:py-10">
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <span className="breadcrumb-current">Contacto</span>
        </nav>

        <div className="max-w-3xl mx-auto pt-6 sm:pt-8 pb-12">
          <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark mb-2">Contacto</h1>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-8">
            Escribinos y te ayudamos con tu compra.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whatsappUrl && (
              <ContactCard icon={<WhatsAppIcon />} title="WhatsApp">
                <p className="text-sm text-gray-600 mb-4">Es la forma más rápida de hablar con nosotros.</p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Escribir por WhatsApp (se abre en una pestaña nueva)"
                  className={`btn-primary-sm inline-flex items-center justify-center gap-2 w-full min-h-11 ${FOCUS}`}
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  Escribir por WhatsApp
                </a>
              </ContactCard>
            )}

            <ContactCard icon={<Mail className="w-5 h-5" aria-hidden="true" />} title="Email">
              <a
                href={`mailto:${LEGAL.EMAIL_CONTACTO}`}
                className={`inline-flex items-center min-h-11 text-sm font-semibold text-accent hover:underline break-all rounded ${FOCUS}`}
              >
                {LEGAL.EMAIL_CONTACTO}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className={`mt-2 flex items-center justify-center gap-2 w-full min-h-11 rounded-lg border border-gray-200 text-sm font-semibold text-primary-dark hover:border-accent hover:text-accent transition-colors cursor-pointer ${FOCUS}`}
              >
                {copied ? <Check className="w-4 h-4 text-accent" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                {copied ? 'Email copiado' : 'Copiar email'}
              </button>
              <span className="sr-only" aria-live="polite">{copied ? 'Email copiado al portapapeles' : ''}</span>
            </ContactCard>

            <ContactCard icon={<MapPin className="w-5 h-5" aria-hidden="true" />} title="Zona de atención">
              <p className="text-sm text-gray-600">Puerto Iguazú, Misiones, Argentina</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <Truck className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                Envíos a todo el país
              </p>
            </ContactCard>

            <ContactCard icon={<Info className="w-5 h-5" aria-hidden="true" />} title="Ayuda rápida">
              <ul className="space-y-1">
                {HELP_LINKS.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className={`flex items-center gap-2 min-h-11 px-2 -mx-2 rounded-lg text-sm font-semibold text-primary-dark hover:text-accent hover:bg-gray-50 transition-colors ${FOCUS}`}
                    >
                      <Icon className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                      <span className="flex-1">{label}</span>
                      <ArrowRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">Si consultás por un pedido, tené a mano tu número de pedido.</p>
            </ContactCard>
          </div>
        </div>
      </div>
    </div>
  )
}
