import type { ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

interface BulkActionBarProps {
  /** Cantidad seleccionada: con 0 la barra no se ve (queda solo la región aria-live, vacía) */
  count: number
  /** Texto del contador, por ejemplo n => `${n} seleccionados` */
  countLabel?: (count: number) => string
  onClear: () => void
  /** Acciones (botones) para la selección */
  children: ReactNode
  /** "Seleccionar los N de …": solo cuando la lista ocupa varias páginas y no está todo seleccionado */
  selectAll?: { label: string; onSelect: () => void; loading?: boolean }
  /** Mientras corre una acción: sin limpiar ni seleccionar más */
  busy?: boolean
}

const defaultCountLabel = (n: number) => `${n.toLocaleString('es-AR')} ${n === 1 ? 'seleccionado' : 'seleccionados'}`

/**
 * Barra de acciones masivas (genérica). Va al final del contenido de la página, dentro del <main> que
 * scrollea: sticky abajo (nunca fixed contra la ventana), así no estira el documento ni tapa el final
 * de la lista. En mobile el contador y los botones se apilan; objetivos de 44px.
 */
export default function BulkActionBar({
  count,
  countLabel = defaultCountLabel,
  onClear,
  children,
  selectAll,
  busy = false,
}: BulkActionBarProps) {
  const visible = count > 0
  return (
    <div className={visible ? 'sticky bottom-3 z-20 mt-4' : undefined} role="region" aria-label="Acciones sobre la selección">
      <div
        className={visible
          ? 'flex flex-col md:flex-row md:items-center gap-2 md:gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A2B27] shadow-lg px-3 py-2'
          : undefined}
      >
        <div className={visible ? 'flex flex-wrap items-center gap-x-1 gap-y-1 min-w-0' : undefined}>
          {/* Siempre montada: así el lector de pantalla anuncia cada cambio, también el primero */}
          <p aria-live="polite" className={visible ? 'text-sm font-semibold text-gray-800 dark:text-white/80 px-1 tabular-nums' : undefined}>
            {visible ? countLabel(count) : ''}
          </p>
          {visible && selectAll && (
            <button
              type="button"
              onClick={selectAll.onSelect}
              disabled={busy || selectAll.loading}
              className="inline-flex items-center gap-1.5 min-h-11 md:min-h-9 px-2 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] hover:underline rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {selectAll.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {selectAll.label}
            </button>
          )}
          {visible && (
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="inline-flex items-center gap-1 min-h-11 md:min-h-9 px-2 text-sm text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Limpiar selección
            </button>
          )}
        </div>
        {visible && (
          <div className="flex gap-2 md:ml-auto [&>*]:flex-1 md:[&>*]:flex-none">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
