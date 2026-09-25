import { Truck, ShieldCheck, Headphones, BadgeCheck } from 'lucide-react'
import { motion } from 'framer-motion'

const benefits = [
  { icon: Truck, label: 'Envíos a todo el país', desc: 'Recibí tu pedido donde estés' },
  { icon: ShieldCheck, label: 'Compra segura', desc: 'Tus datos protegidos' },
  { icon: Headphones, label: 'Atención personalizada', desc: 'Te ayudamos en cada paso' },
  { icon: BadgeCheck, label: 'Garantía incluida', desc: 'Productos con garantía oficial' },
]

export default function TrustBar() {
  return (
    <section className="bg-primary">
      <div className="store-container py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {benefits.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div className="trust-icon">
                <b.icon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-white font-bold text-xs sm:text-sm">{b.label}</p>
                <p className="text-white/50 text-[11px] hidden sm:block">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
