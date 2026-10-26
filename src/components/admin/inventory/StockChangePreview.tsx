import { AlertTriangle, ArrowRight, Ban, Equal, PackageX } from 'lucide-react'
import { Pill } from '../products/PriceChangePreview'
import { formatDiff, type StockExclusion, type StockPreview, type StockPreviewRow } from '../../../lib/stockChange'

export type StockPreviewFilter = 'todos' | 'modificados' | 'excluidos'

const EXCLUSION_LABELS: Record<StockExclusion, string> = {
  bajo_reservado: 'Excluida: queda por debajo de lo reservado',
  no_alcanza: 'Excluida: no alcanza el stock',
  supera_maximo: 'Excluida: supera el máximo',
  no_disponible: 'Excluida: no disponible (papelera o eliminado)',
}

/** Insignias de una fila (texto + ícono: no dependen solo del color) */
function RowBadges({ row }: { row: StockPreviewRow }) {
  return (
    <>
      {row.exclusion && <Pill tone="red" icon={<Ban className="w-3 h-3" aria-hidden="true" />}>{EXCLUSION_LABELS[row.exclusion]}</Pill>}
      {row.status === 'sin_cambio' && <Pill tone="gray" icon={<Equal className="w-3 h-3" aria-hidden="true" />}>Sin cambio</Pill>}
      {row.status === 'modificada' && <Pill tone="teal" icon={<ArrowRight className="w-3 h-3" aria-hidden="true" />}>Se modifica</Pill>}
      {row.agotada && <Pill tone="amber" icon={<PackageX className="w-3 h-3" aria-hidden="true" />}>Quedará agotado</Pill>}
    </>
  )
}

const num = (n: number | null) => (n === null ? '—' : n.toLocaleString('es-AR'))

function NewStock({ row }: { row: StockPreviewRow }) {
  if (row.nuevo === null) return <span className="text-gray-400 dark:text-white/30">—</span>
  const invalid = row.exclusion !== null
  return (
    <span className={`tabular-nums whitespace-nowrap ${invalid ? 'text-red-700 dark:text-red-300 line-through' : 'font-semibold text-gray-800 dark:text-white/90'}`}>
      {invalid && <AlertTriangle className="inline w-3.5 h-3.5 mr-1 align-[-2px] no-underline" aria-hidden="true" />}
      {num(row.nuevo)}
    </span>
  )
}

function Detail({ row }: { row: StockPreviewRow }) {
  if (!row.detalle && !row.varianteInactiva) return null
  return (
    <span className="block text-xs font-normal text-gray-500 dark:text-white/50 mt-0.5 break-words">
      {row.detalle}
      {row.varianteInactiva && <span className="ml-1.5 align-middle"><Pill tone="gray">inactiva</Pill></span>}
    </span>
  )
}

function filterRows(rows: StockPreviewRow[], filter: StockPreviewFilter) {
  if (filter === 'modificados') return rows.filter(r => r.status === 'modificada')
  if (filter === 'excluidos') return rows.filter(r => r.status === 'excluida')
  return rows
}

export default function StockChangePreview({ preview, filter }: { preview: StockPreview; filter: StockPreviewFilter }) {
  const rows = filterRows(preview.rows, filter)

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-white/50 py-4 text-center">
        {filter === 'excluidos' ? 'No hay filas excluidas.' : 'No hay filas para mostrar con este filtro.'}
      </p>
    )
  }

  return (
    <>
      {/* Escritorio y tablet: tabla */}
      <table className="hidden md:table w-full text-sm">
        <caption className="text-left text-xs text-gray-500 dark:text-white/40 pb-2">
          Stock actual y nuevo por fila (cada variante es una fila aparte)
        </caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-white/40">
            <th scope="col" className="text-left font-medium py-2 pr-3">Producto / fila</th>
            <th scope="col" className="text-right font-medium py-2 px-3">Actual</th>
            <th scope="col" className="text-right font-medium py-2 px-3">Reservado</th>
            <th scope="col" className="text-right font-medium py-2 px-3">Nuevo</th>
            <th scope="col" className="text-right font-medium py-2 px-3">Diferencia</th>
            <th scope="col" className="text-left font-medium py-2 pl-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className={`border-b border-gray-100 dark:border-white/5 ${row.status === 'excluida' ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}
            >
              <th scope="row" className="text-left font-semibold text-gray-800 dark:text-white/90 py-2 pr-3 align-top">
                <span className="break-words">{row.titulo}</span>
                <Detail row={row} />
              </th>
              <td className="text-right py-2 px-3 align-top tabular-nums text-gray-600 dark:text-white/60">{num(row.actual)}</td>
              <td className="text-right py-2 px-3 align-top tabular-nums text-gray-600 dark:text-white/60">{num(row.reservado)}</td>
              <td className="text-right py-2 px-3 align-top"><NewStock row={row} /></td>
              <td className="text-right py-2 px-3 align-top tabular-nums text-gray-600 dark:text-white/60 whitespace-nowrap">
                {row.exclusion ? '—' : formatDiff(row.diferencia)}
              </td>
              <td className="py-2 pl-3 align-top">
                <div className="flex flex-wrap gap-1"><RowBadges row={row} /></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: tarjetas */}
      <ul className="md:hidden space-y-3">
        {rows.map(row => (
          <li
            key={row.id}
            className={`rounded-lg border p-3 ${row.status === 'excluida' ? 'border-red-200 dark:border-red-500/30' : 'border-gray-200 dark:border-white/10'}`}
          >
            <p className="text-sm font-semibold text-gray-800 dark:text-white/90 break-words">
              {row.titulo}
              <Detail row={row} />
            </p>
            <dl className="grid grid-cols-4 gap-2 mt-2 text-sm">
              <div>
                <dt className="text-[11px] text-gray-500 dark:text-white/50">Actual</dt>
                <dd className="tabular-nums text-gray-700 dark:text-white/70">{num(row.actual)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-500 dark:text-white/50">Reservado</dt>
                <dd className="tabular-nums text-gray-700 dark:text-white/70">{num(row.reservado)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-500 dark:text-white/50">Nuevo</dt>
                <dd><NewStock row={row} /></dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-500 dark:text-white/50">Diferencia</dt>
                <dd className="tabular-nums text-gray-700 dark:text-white/70">{row.exclusion ? '—' : formatDiff(row.diferencia)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-1 mt-2"><RowBadges row={row} /></div>
          </li>
        ))}
      </ul>
    </>
  )
}
