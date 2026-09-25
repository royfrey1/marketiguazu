import { Truck, ShieldCheck, Headphones } from 'lucide-react'

export default function TopBar() {
  return (
    <div className="bg-primary-dark text-white text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-9">
        <div className="flex items-center gap-6">
          <span className="hidden sm:flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-accent" />
            Envíos a todo el país
          </span>
          <span className="hidden md:flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            Compra segura
          </span>
          <span className="hidden lg:flex items-center gap-1.5">
            <Headphones className="w-3.5 h-3.5 text-accent" />
            Atención personalizada
          </span>
        </div>
        <span className="text-white/60 text-[11px]">
          Puerto Iguazú, Misiones
        </span>
      </div>
    </div>
  )
}
