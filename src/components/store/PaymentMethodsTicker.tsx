import { Fragment } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PAYMENT_METHODS } from './paymentMethods'

// Cada mitad repite los 3 métodos varias veces para que siempre sea más ancha
// que la pantalla (aun en monitores grandes); la segunda mitad es una copia
// exacta, así el desplazamiento de 0 a -50% cierra el loop sin salto visible.
const REPEATS_PER_HALF = 4
const SECONDS_PER_HALF = 45

function TickerItems({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="flex items-center shrink-0" aria-hidden={hidden || undefined}>
      {Array.from({ length: REPEATS_PER_HALF }).map((_, r) =>
        PAYMENT_METHODS.map((m, i) => (
          <Fragment key={`${r}-${i}`}>
            <span className="flex items-center gap-2 whitespace-nowrap px-8">
              <m.icon className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
              {m.label}
            </span>
            <span className="h-4 w-px bg-white/20 shrink-0" aria-hidden="true" />
          </Fragment>
        ))
      )}
    </div>
  )
}

/** Franja con los medios de pago, en desplazamiento horizontal continuo. */
export default function PaymentMethodsTicker() {
  const reduceMotion = useReducedMotion()

  return (
    <section aria-label="Medios de pago" className="bg-primary-dark text-white text-xs h-9 overflow-hidden">
      {reduceMotion ? (
        // Sin animación: fila estática centrada (con scroll si no entra)
        <ul className="h-full flex items-center justify-start sm:justify-center overflow-x-auto">
          {PAYMENT_METHODS.map((m, i) => (
            <li key={m.label} className="flex items-center shrink-0">
              {i > 0 && <span className="h-4 w-px bg-white/20" aria-hidden="true" />}
              <span className="flex items-center gap-2 whitespace-nowrap px-6">
                <m.icon className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {/* Lista legible para lectores de pantalla; la cinta animada es decorativa */}
          <ul className="sr-only">
            {PAYMENT_METHODS.map(m => <li key={m.label}>{m.label}</li>)}
          </ul>
          <motion.div
            className="h-full flex items-center w-max"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: SECONDS_PER_HALF, ease: 'linear', repeat: Infinity }}
          >
            <TickerItems hidden />
            <TickerItems hidden />
          </motion.div>
        </>
      )}
    </section>
  )
}
