import { Link } from 'react-router-dom'
import logo from '../../assets/images/iguazu1.png'

interface FooterProps {
  className?: string
}

export default function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={`bg-gray-900 text-gray-400 mt-20 border-t border-gray-800 ${className}`.trim()}>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <img src={logo} alt="Iguazú Marketplace" className="transition-all duration-300 object-contain h-22 md:h-24" />
              </Link>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              La plataforma de comercio local que conecta a compradores y vendedores de Puerto Iguazú y ciudades cercanas de forma directa, rápida y transparente.
            </p>
          </div>
          <div className="space-y-3 border-t md:border-t-0 md:border-x border-gray-800 pt-4 md:pt-0 md:px-6">
            <h4 className="pt-6 text-white font-bold text-xs uppercase tracking-wider">Navegación</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/" className="hover:text-[#1CAAA8] transition-colors">Inicio</Link></li>
              <li><Link to="/register" className="hover:text-[#1CAAA8] transition-colors">Crear Cuenta</Link></li>
              <li><span className="text-gray-600 cursor-not-allowed">Categorías populares</span></li>
            </ul>
          </div>
          <div className="space-y-3 border-t md:border-t-0 pt-4 md:pt-0 md:px-6 border-gray-800 md:border-l">
            <h4 className="pt-6 text-white font-bold text-xs uppercase tracking-wider">Soporte y Legales</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-[#1CAAA8] transition-colors cursor-pointer">Preguntas Frecuentes</span></li>
              <li><span className="hover:text-[#1CAAA8] transition-colors cursor-pointer">Términos y Condiciones</span></li>
              <li><span className="hover:text-[#1CAAA8] transition-colors cursor-pointer">Políticas de Privacidad</span></li>
            </ul>
          </div>
          <div className="space-y-3 bg-gray-800 p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
              <span>⚠️</span> Consejos de Seguridad
            </div>
            <p className="text-[11px] text-gray-300 leading-normal">
              Recordá coordinar tus entregas en lugares públicos y concurridos de la ciudad. No realices transferencias bancarias adelantadas sin verificar la identidad del vendedor.
            </p>
          </div>
        </div>
        <div className="pt-8 border-t border-gray-600 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-300">
          <p>© {new Date().getFullYear()} Iguazú Marketplace. Todos los derechos reservados.</p>
          <Link to="/report" className="p-2 border border-dashed border-gray-200 text-gray-200 hover:text-red-500 hover:border-red-500 transition-colors">
            ⚠️ REPORTAR UN PROBLEMA
          </Link>
          <p className="font-medium">
            Desarrollado por{' '}
            <a
              href="https://portfolio-royf.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#389C52] hover:text-[#389C52]/50 font-black underline underline-offset-3 decoration-gray-700 hover:decoration-[#15807e] transition-all"
            >
              Roy Frey
            </a>
            {' '}en <span className="text-gray-400">Iguazu, Misiones, Argentina</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
