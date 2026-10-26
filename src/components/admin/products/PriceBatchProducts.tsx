import { Fragment } from 'react'

interface PriceBatchProductsProps {
  /** Títulos tal cual vienen del servidor (hasta 5) */
  names: string[]
  /** Todos los productos distintos del lote: lo que excede a `names` se muestra como "y N más" */
  total: number
  /** Texto antes de la lista (solo para lectores de pantalla); "" si el contexto ya lo dice */
  prefix?: string
  className?: string
}

const MAX_NAME_CHARS = 40

/** Recorta por caracteres visibles (Array.from no parte emoji ni tildes compuestas en dos) */
function shorten(name: string): string | null {
  const chars = Array.from(name.trim())
  return chars.length > MAX_NAME_CHARS ? chars.slice(0, MAX_NAME_CHARS - 1).join('').trimEnd() + '…' : null
}

/**
 * "Mate, Termo, Taza y 2 más". Los títulos largos se ven recortados (el completo queda para el lector de
 * pantalla y en `title`) y la lista se corta a 2 renglones; el "y N más" queda afuera del recorte para que
 * siempre se vea. Sin nombres no muestra nada.
 */
export default function PriceBatchProducts({ names, total, prefix, className = '' }: PriceBatchProductsProps) {
  if (names.length === 0) return null
  const rest = total - names.length
  const last = (i: number) => i === names.length - 1 && rest <= 0
  const full = names.map((name, i) => (i === 0 ? '' : last(i) ? ' y ' : ', ') + name).join('')
  return (
    <div className={`relative flex items-end gap-1 min-w-0 ${className}`}>
      <p title={full} className="line-clamp-2 break-words min-w-0">
        {prefix !== '' && <span className="sr-only">{prefix ?? 'Productos: '}</span>}
        {names.map((name, i) => {
          const short = shorten(name)
          return (
            <Fragment key={i}>
              {i > 0 && (last(i) ? ' y ' : ', ')}
              {short ? (
                <span title={name}>
                  <span aria-hidden="true">{short}</span>
                  <span className="sr-only">{name}</span>
                </span>
              ) : name}
            </Fragment>
          )
        })}
      </p>
      {rest > 0 && <span className="shrink-0 whitespace-nowrap">y {rest.toLocaleString('es-AR')} más</span>}
    </div>
  )
}
