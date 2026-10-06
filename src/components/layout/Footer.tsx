import { Link } from 'react-router-dom'
import { MapPin, Mail, ShoppingBag, HelpCircle, ArrowUpRight, Flag } from 'lucide-react'
import logo from '../../assets/images/iguazu1.png'
import { LEGAL } from '../../config/legal'

export default function Footer() {
  return (
    <footer className="bg-primary-dark">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-16 pb-10">
        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10 mb-14">
          {/* ── Col 1: Identity ── */}
          <div className="space-y-5 lg:col-span-1">
            <Link to="/" className="inline-block">
              <img src={logo} alt="Iguazú Marketplace" className="h-18 sm:h-22 object-contain" />
            </Link>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Tu tienda de confianza. Tecnologia en tendencia, ultimos lanzamientos de Smartphones, consolas, accesorios y más.
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
                  className="hover:text-white/70 transition-colors"
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
            <ul className="space-y-2.5">
              <FooterLink to="/busqueda?category=smartphones">Smartphones</FooterLink>
              <FooterLink to="/busqueda?category=hardware">Hardware</FooterLink>
              <FooterLink to="/busqueda?category=audio">Audio</FooterLink>
              <FooterLink to="/busqueda?category=monitores">Monitores</FooterLink>
              <FooterLink to="/busqueda?category=perifericos">Periféricos</FooterLink>
              <FooterLink to="/busqueda" accent>Todos los productos</FooterLink>
            </ul>
          </div>

          {/* ── Col 3: Iguazú Marketplace ── */}
          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Iguazú Marketplace
            </h4>
            <ul className="space-y-2.5">
              <FooterSpan>Nosotros</FooterSpan>
              <li>
                <a
                  href={`mailto:${LEGAL.EMAIL_CONTACTO}`}
                  className="text-sm transition-colors inline-flex items-center gap-1.5 text-white/45 hover:text-white/80"
                >
                  Contacto
                </a>
              </li>
              <FooterSpan>Preguntas frecuentes</FooterSpan>
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
            <ul className="space-y-2.5">
              <FooterSpan>Envíos</FooterSpan>
              <FooterSpan>Medios de pago</FooterSpan>
              <FooterLink to="/devoluciones">Garantías</FooterLink>
              <FooterLink to="/devoluciones">Cambios y devoluciones</FooterLink>
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
              className="inline-flex items-center gap-1 text-accent hover:text-accent/80 font-bold transition-colors"
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
        className={`text-sm transition-colors inline-flex items-center gap-1.5 ${
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

function FooterSpan({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <span className="text-sm text-white/45 hover:text-white/80 transition-colors cursor-pointer">
        {children}
      </span>
    </li>
  )
}
