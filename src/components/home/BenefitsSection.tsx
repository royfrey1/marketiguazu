import { motion } from 'framer-motion'
import { Truck, ShieldCheck, Headphones, BadgeCheck } from 'lucide-react'

const benefits = [
  {
    icon: Truck,
    title: 'Envíos a todo el país',
    desc: 'Recibí tu pedido en cualquier punto de Argentina. Coordinamos la entrega para que sea cómodo.',
  },
  {
    icon: ShieldCheck,
    title: 'Compra segura',
    desc: 'Tus datos están protegidos. Cada transacción es segura y confiable.',
  },
  {
    icon: Headphones,
    title: 'Atención personalizada',
    desc: 'Te ayudamos a encontrar lo que necesitás. Contactanos por cualquier consulta.',
  },
  {
    icon: BadgeCheck,
    title: 'Garantía legal',
    desc: 'Todos nuestros productos tienen garantía legal de 6 meses desde la entrega. Comprá con tranquilidad.',
  },
]

export default function BenefitsSection() {
  return (
    <section className="bg-section-alt section-spacing">
      <div className="store-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="text-meta">Por qué elegirnos</span>
          <h2 className="text-h2 text-2xl sm:text-3xl mt-2">
            Comprá con confianza
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="card-benefit"
            >
              <div className="card-benefit-icon">
                <b.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-h3 text-base mb-2">
                {b.title}
              </h3>
              <p className="text-body">
                {b.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
