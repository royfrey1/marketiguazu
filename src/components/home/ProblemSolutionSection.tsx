import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, Search, Sparkles } from 'lucide-react'

const pairs = [
  {
    problem: 'Productos en tendencia difíciles de conseguir.',
    solution: 'Te acercamos rápidamente los productos que están marcando tendencia.',
  },
  {
    problem: 'Acceso limitado a marcas internacionales y modelos menos comunes.',
    solution: 'Más opciones de productos, modelos y marcas para explorar.',
  },
  {
    problem: 'Precios demasiado altos en Argentina para productos cuyo valor real no lo justifica.',
    solution: 'Ajustamos nuestros precios al valor real del producto, sin sobreprecios desproporcionados.',
  },
]

export default function ProblemSolutionSection() {
  const reduceMotion = useReducedMotion()

  const reveal = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.25 },
          transition: { duration: 0.2, delay },
        }

  return (
    <section
      aria-labelledby="problem-solution-title"
      className="bg-primary-dark section-spacing overflow-hidden"
    >
      <div className="store-container">
        <motion.header
          {...reveal()}
          className="max-w-2xl"
        >
          <h2
            id="problem-solution-title"
            className="text-display text-white text-2xl sm:text-3xl md:text-4xl mb-4"
          >
            Tecnología más accesible, sin tantas vueltas.
          </h2>
          <p className="text-white/60 text-sm sm:text-base leading-relaxed">
            Sabemos que encontrar ciertos productos y marcas a precios accesibles, puede ser difícil.
            Por eso buscamos acercarte más opciones y una forma más justa de acceder a
            la tecnología que querés.
          </p>
        </motion.header>

        <div className="mt-10 sm:mt-12">
          <div
            className="hidden md:grid md:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-8 pb-3 mb-2 border-b border-white/10"
            aria-hidden="true"
          >
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              <Search className="w-3.5 h-3.5" />
              Problema
            </span>
            <span className="w-5 lg:w-10" />
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accent">
              Nuestra solución
            </span>
          </div>

          <ul className="space-y-4 sm:space-y-5 list-none">
            {pairs.map((pair, i) => (
              <motion.li
                key={pair.problem}
                {...reveal(i * 0.06)}
                className="grid md:grid-cols-[1fr_auto_1fr] gap-2.5 md:gap-4 lg:gap-8 items-start md:items-center"
              >
                <div className="min-w-0">
                  <span className="md:hidden flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                    <Search className="w-3 h-3" aria-hidden="true" />
                    Problema
                  </span>
                  <p className="text-white/55 text-sm sm:text-base leading-relaxed">
                    {pair.problem}
                  </p>
                </div>

                <div
                  className="flex md:justify-center text-accent md:self-center"
                  aria-hidden="true"
                >
                  <ArrowRight className="hidden md:block w-5 h-5 shrink-0" />
                  <ArrowDown className="md:hidden w-4 h-4 shrink-0 my-0.5" />
                </div>

                <div className="min-w-0 rounded-lg md:rounded-none md:bg-transparent bg-white/[0.04] md:px-0 px-3 py-2 md:py-0">
                  <span className="md:hidden flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent mb-1">
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    Nuestra solución
                  </span>
                  <p className="text-white font-semibold text-sm sm:text-base leading-relaxed">
                    {pair.solution}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.p
          {...reveal(0.12)}
          className="mt-10 sm:mt-12 text-center font-display font-black leading-[1.1] text-white text-xl sm:text-2xl md:text-3xl"
        >
          Más opciones. <span className="text-accent">Más acceso.</span> Menos vueltas.
        </motion.p>
      </div>
    </section>
  )
}
