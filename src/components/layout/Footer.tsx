import { Link } from 'react-router-dom'
import { MapPin, Mail, ShoppingBag, HelpCircle, ArrowUpRight, Flag } from 'lucide-react'
import logo from '../../assets/images/iguazu1.png'
import { LEGAL } from '../../config/legal'

// Foco por teclado visible, igual que en el navbar
const FOCUS_RING = 'rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
// Área táctil: 44px en pantallas táctiles/mobile; desde lg (con puntero) compacta, sin bajar de 24px
const TOUCH_TARGET = 'min-h-11 lg:min-h-6'

// Categorías de "Comprar": /categoria/:slug lista los productos de la categoría y de sus subcategorías.
// Las etiquetas van escritas acá (con su ortografía) y no se toman del nombre guardado en la base.
const SHOP_LINKS: { label: string; to: string }[] = [
  { label: 'Smartphones', to: '/categoria/smartphones' },
  { label: 'Procesadores', to: '/categoria/procesadores' },
  { label: 'Auriculares', to: '/categoria/auriculares' },
  { label: 'Monitores', to: '/categoria/monitores' },
  { label: 'Periféricos', to: '/categoria/perifericos' },
]

export default function Footer() {
  return (
    <footer className="bg-primary-dark">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-16 pb-10">
        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10 mb-14">
          {/* ── Col 1: Identity ── */}
          <div className="space-y-5 lg:col-span-1">
            <Link to="/" className={`inline-block ${FOCUS_RING}`}>
              <img src={logo} alt="Iguazú Marketplace" className="h-18 sm:h-22 object-contain" />
            </Link>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Tu tienda de confianza. Tecnología en tendencia, últimos lanzamientos de smartphones, consolas, accesorios y más.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-white/40 text-sm">
                <MapPin className="w-4 h-4 text-accent shrink-0" />
                Puerto Iguazú, Misiones
              </div>
              <div className="flex items-center gap-2.5 text-white/40 text-sm">
                <Mail className="w-4 h-4 text-accent shrink-0" />
                <a
                  href={`mailto:${LEGAL.EMAIL_CONTACTO}`}
                  className={`inline-flex items-center ${TOUCH_TARGET} hover:text-white/70 transition-colors ${FOCUS_RING}`}
                >
                  {LEGAL.EMAIL_CONTACTO}
                </a>
              </div>
            </div>
          </div>

          {/* ── Col 2: Comprar ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-accent" />
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                Comprar
              </h4>
            </div>
            <ul className="lg:space-y-1.5">
              {SHOP_LINKS.map(link => (
                <FooterLink key={link.label} to={link.to}>{link.label}</FooterLink>
              ))}
              <FooterLink to="/busqueda" accent>Todos los productos</FooterLink>
            </ul>
          </div>

          {/* ── Col 3: Iguazú Marketplace ── */}
          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Iguazú Marketplace
            </h4>
            <ul className="lg:space-y-1.5">
              <FooterLink to="/nosotros">Nosotros</FooterLink>
              <FooterLink to="/contacto">Contacto</FooterLink>
              <FooterLink to="/preguntas-frecuentes">Preguntas frecuentes</FooterLink>
              <FooterLink to="/privacidad">Política de Privacidad</FooterLink>
              <FooterLink to="/terminos">Términos y Condiciones</FooterLink>
            </ul>
          </div>

          {/* ── Col 4: Ayuda ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-accent" />
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                Ayuda
              </h4>
            </div>
            <ul className="lg:space-y-1.5">
              <FooterLink to="/envios">Envíos</FooterLink>
              <FooterLink to="/medios-de-pago">Medios de pago</FooterLink>
              <FooterLink to="/devoluciones">Garantías, cambios y devoluciones</FooterLink>
              <FooterLink to="/arrepentimiento">Botón de arrepentimiento</FooterLink>
              <FooterLink to="/report" accent icon={<Flag className="w-3.5 h-3.5" />}>Reportar un problema</FooterLink>
            </ul>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-white/10" />

        {/* ── Bottom bar ── */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/30">
          <p>© {new Date().getFullYear()} Iguazú Marketplace. Todos los derechos reservados.</p>
          <p>
            Desarrollado por{' '}
            <a
              href="https://portfolio-royf.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 ${TOUCH_TARGET} text-accent hover:text-accent/80 font-bold transition-colors ${FOCUS_RING}`}
            >
              Roy Frey
              <ArrowUpRight className="w-3 h-3" />
            </a>
            {' '}en Puerto Iguazú, Misiones, Argentina
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ── Internal components ── */

function FooterLink({
  to,
  children,
  accent = false,
  icon,
}: {
  to: string
  children: React.ReactNode
  accent?: boolean
  icon?: React.ReactNode
}) {
  return (
    <li>
      <Link
        to={to}
        className={`text-sm transition-colors inline-flex items-center gap-1.5 ${TOUCH_TARGET} ${FOCUS_RING} ${
          accent
            ? 'text-accent/80 hover:text-accent font-medium'
            : 'text-white/45 hover:text-white/80'
        }`}
      >
        {icon}
        {children}
      </Link>
    </li>
  )
}
