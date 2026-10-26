import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, Ban, Equal, TrendingUp } from 'lucide-react'
import { formatArs } from '../../../lib/offers'
import {
  BIG_CHANGE_PCT,
  formatPct,
  type PriceExclusion,
  type PricePreview,
  type PreviewProduct,
  type PreviewRow,
} from '../../../lib/priceChange'

export type PreviewFilter = 'todos' | 'modificados' | 'excluidos'

const EXCLUSION_LABELS: Record<PriceExclusion, string> = {
  oferta_invalida: 'Excluido: oferta inválida',
  precio_invalido: 'Excluido: precio resultante inválido',
  en_papelera: 'Excluido: en la papelera',
  no_existe: 'Excluido: ya no existe',
}

const EXCLUSION_HELP: Record<PriceExclusion, string> = {
  oferta_invalida: 'Con el precio nuevo, una oferta quedaría sin descuento real o con más de 90%. Ajustalo a mano.',
  precio_invalido: 'Algún precio quedaría en $0 o menos (o supera el máximo). Ajustalo a mano.',
  en_papelera: 'Restauralo desde la Papelera si querés cambiarle el precio.',
  no_existe: 'Se eliminó mientras lo tenías seleccionado.',
}

type Tone = 'gray' | 'red' | 'amber' | 'teal'

const TONES: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70',
  red: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  amber: 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
  teal: 'bg-[#185749]/10 text-[#0D3732] dark:bg-[#1CAAA8]/15 dark:text-[#7fe0de]',
}

export function Pill({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold leading-tight ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  )
}

/** Insignias de una fila (texto + ícono: no dependen solo del color) */
function RowBadges({ row, hideUnchanged = false }: { row: PreviewRow; hideUnchanged?: boolean }) {
  return (
    <>
      {row.precioInvalido && <Pill tone="red" icon={<Ban className="w-3 h-3" aria-hidden="true" />}>Precio inválido</Pill>}
      {row.ofertaInvalida && <Pill tone="red" icon={<Ban className="w-3 h-3" aria-hidden="true" />}>Oferta inválida</Pill>}
      {!hideUnchanged && !row.precioInvalido && !row.cambia && <Pill tone="gray" icon={<Equal className="w-3 h-3" aria-hidden="true" />}>Sin cambio</Pill>}
      {!row.precioInvalido && row.cambia && row.grande && (
        <Pill tone="amber" icon={<TrendingUp className="w-3 h-3" aria-hidden="true" />}>Cambio grande (más de {BIG_CHANGE_PCT}%)</Pill>
      )}
    </>
  )
}

function ProductBadges({ product }: { product: PreviewProduct }) {
  if (product.exclusion) {
    return <Pill tone="red" icon={<Ban className="w-3 h-3" aria-hidden="true" />}>{EXCLUSION_LABELS[product.exclusion]}</Pill>
  }
  if (product.status === 'sin_cambio') return <Pill tone="gray" icon={<Equal className="w-3 h-3" aria-hidden="true" />}>Sin cambio</Pill>
  return <Pill tone="teal" icon={<ArrowRight className="w-3 h-3" aria-hidden="true" />}>Se modifica</Pill>
}

const Price = ({ value, strike = false }: { value: number; strike?: boolean }) => (
  <span className={`tabular-nums whitespace-nowrap ${strike ? 'text-gray-500 dark:text-white/40' : 'font-semibold text-gray-800 dark:text-white/90'}`}>
    {formatArs(value)}
  </span>
)

function rowLabel(row: PreviewRow, hasVariants: boolean) {
  if (row.variantId === null) return hasVariants ? 'Precio base' : null
  return row.nombre
}

function filterPreview(products: PreviewProduct[], filter: PreviewFilter) {
  if (filter === 'modificados') return products.filter(p => p.status === 'modificado')
  if (filter === 'excluidos') return products.filter(p => p.status === 'excluido')
  return products
}

export default function PriceChangePreview({ preview, filter }: { preview: PricePreview; filter: PreviewFilter }) {
  const products = filterPreview(preview.products, filter)

  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-white/50 py-4 text-center">
        {filter === 'excluidos' ? 'No hay productos excluidos.' : 'No hay productos para mostrar con este filtro.'}
      </p>
    )
  }

  return (
    <>
      {/* Escritorio y tablet: tabla */}
      <table className="hidden md:table w-full text-sm">
        <caption className="text-left text-xs text-gray-500 dark:text-white/40 pb-2">
          Precios actuales y nuevos por producto (las variantes van debajo de su producto)
        </caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-white/40">
            <th scope="col" className="text-left font-medium py-2 pr-3">Producto / variante</th>
            <th scope="col" className="text-right font-medium py-2 px-3">Antes</th>
            <th scope="col" className="text-right font-medium py-2 px-3">Después</th>
            <th scope="col" className="text-right font-medium py-2 px-3">Variación</th>
            <th scope="col" className="text-left font-medium py-2 pl-3">Estado</th>
          </tr>
        </thead>
        {products.map(product => {
          const hasVariants = product.variantes.length > 0
          const rows = product.base ? [product.base, ...product.variantes] : []
          return (
            <tbody key={product.id} className="border-b border-gray-100 dark:border-white/5">
              <tr className={product.status === 'excluido' ? 'bg-red-50/40 dark:bg-red-900/10' : undefined}>
                <th scope="row" className="text-left font-semibold text-gray-800 dark:text-white/90 pt-3 pb-1 pr-3 align-top">
                  <span className="break-words">{product.titulo}</span>
                  {product.exclusion && (
                    <span className="block text-xs font-normal text-gray-500 dark:text-white/50 mt-0.5">{EXCLUSION_HELP[product.exclusion]}</span>
                  )}
                </th>
                {rows.length === 0 ? (
                  <td colSpan={3} className="text-right text-gray-400 dark:text-white/30 pt-3 px-3 align-top">—</td>
                ) : hasVariants ? (
                  <td colSpan={3} />
                ) : (
                  <PriceCells row={rows[0]} first />
                )}
                <td className="pt-3 pb-1 pl-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    <ProductBadges product={product} />
                    {!hasVariants && rows[0] && <RowBadges row={rows[0]} hideUnchanged />}
                  </div>
                </td>
              </tr>
              {hasVariants && rows.map(row => (
                <tr key={row.variantId ?? 'base'} className="text-gray-700 dark:text-white/70">
                  <th scope="row" className="text-left font-normal py-1 pl-4 pr-3 align-top">
                    <span className="break-words">{rowLabel(row, hasVariants)}</span>
                    {row.variantId !== null && !row.activo && (
                      <span className="ml-1.5 align-middle"><Pill tone="gray">inactiva</Pill></span>
                    )}
                  </th>
                  <PriceCells row={row} />
                  <td className="py-1 pl-3 align-top">
                    <div className="flex flex-wrap gap-1"><RowBadges row={row} /></div>
                  </td>
                </tr>
              ))}
              <tr aria-hidden="true"><td colSpan={5} className="h-2" /></tr>
            </tbody>
          )
        })}
      </table>

      {/* Mobile: tarjetas */}
      <ul className="md:hidden space-y-3">
        {products.map(product => {
          const hasVariants = product.variantes.length > 0
          const rows = product.base ? [product.base, ...product.variantes] : []
          return (
            <li
              key={product.id}
              className={`rounded-lg border p-3 ${product.status === 'excluido' ? 'border-red-200 dark:border-red-500/30' : 'border-gray-200 dark:border-white/10'}`}
            >
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90 break-words">{product.titulo}</p>
              <div className="flex flex-wrap gap-1 mt-1"><ProductBadges product={product} /></div>
              {product.exclusion && <p className="text-xs text-gray-500 dark:text-white/50 mt-1">{EXCLUSION_HELP[product.exclusion]}</p>}
              {rows.length > 0 && (
                <dl className="mt-2 space-y-2">
                  {rows.map(row => (
                    <div key={row.variantId ?? 'base'} className="text-sm">
                      {rowLabel(row, hasVariants) && (
                        <dt className="text-xs text-gray-500 dark:text-white/50">
                          {rowLabel(row, hasVariants)}
                          {row.variantId !== null && !row.activo && <span className="ml-1"><Pill tone="gray">inactiva</Pill></span>}
                        </dt>
                      )}
                      <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Price value={row.antes} strike />
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" aria-label="pasa a" />
                        {row.precioInvalido ? <span className="text-red-700 dark:text-red-300 font-semibold">inválido</span> : <Price value={row.despues} />}
                        <span className="text-xs tabular-nums text-gray-500 dark:text-white/50">{formatPct(row.precioInvalido ? null : row.variacion)}</span>
                        <RowBadges row={row} hideUnchanged={!hasVariants} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function PriceCells({ row, first = false }: { row: PreviewRow; first?: boolean }) {
  const pad = first ? 'pt-3 pb-1' : 'py-1'
  return (
    <>
      <td className={`text-right ${pad} px-3 align-top`}><Price value={row.antes} strike /></td>
      <td className={`text-right ${pad} px-3 align-top`}>
        {row.precioInvalido
          ? <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 font-semibold"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />inválido</span>
          : <Price value={row.despues} />}
      </td>
      <td className={`text-right ${pad} px-3 align-top tabular-nums text-gray-600 dark:text-white/60 whitespace-nowrap`}>
        {formatPct(row.precioInvalido ? null : row.variacion)}
      </td>
    </>
  )
}
