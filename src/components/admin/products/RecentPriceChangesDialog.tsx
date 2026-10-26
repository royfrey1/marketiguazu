import { useEffect, useState } from 'react'
import { History, Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import UndoPriceChangeDialog, { type UndoOutcome } from './UndoPriceChangeDialog'
import { describePriceChange } from '../../../lib/priceChange'
import {
  priceChangeService,
  type PriceChangeBatch,
  type PriceChangeError,
} from '../../../services/priceChange.service'

interface RecentPriceChangesDialogProps {
  onClose: () => void
  /** Se deshizo un cambio desde acá: recargar la tabla (y ocultar el aviso si era ese lote) */
  onUndone: (batchId: string, outcome: UndoOutcome) => void
}

const DATE = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const n = (count: number | null, one: string, many: string) => `${(count ?? 0).toLocaleString('es-AR')} ${count === 1 ? one : many}`

export default function RecentPriceChangesDialog({ onClose, onUndone }: RecentPriceChangesDialogProps) {
  const [batches, setBatches] = useState<PriceChangeBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PriceChangeError | null>(null)
  const [undoTarget, setUndoTarget] = useState<PriceChangeBatch | null>(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void priceChangeService.listRecentPriceBatches(10).then(({ data, error: listError }) => {
      if (cancelled) return
      setBatches(data)
      setError(listError)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [reloadKey])

  const load = () => {
    setLoading(true)
    setError(null)
    setReloadKey(k => k + 1)
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Cambios de precios recientes"
        description="Los últimos 10 cambios masivos. Podés deshacer los que todavía no se deshicieron."
        size="lg"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-tap sm:min-h-0 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        }
      >
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Cargando cambios recientes...
          </p>
        ) : error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-red-700 dark:text-red-400"><FriendlyError error={error} prefix="No se pudieron cargar los cambios. " /></p>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-1.5 min-h-tap sm:min-h-9 px-3 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749]/30 dark:border-[#1CAAA8]/30 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : batches.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
            <History className="w-4 h-4" aria-hidden="true" />
            Todavía no hay cambios masivos de precios.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {batches.map(batch => {
              const isUndo = !!batch.undo_of
              const undone = !!batch.undone_at
              const summary = isUndo ? 'Deshacer de un cambio anterior' : describePriceChange(batch.meta)
              return (
                <li key={batch.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-gray-800 dark:text-white/90">{summary}</p>
                    <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">
                      <time dateTime={batch.created_at}>{DATE.format(new Date(batch.created_at))}</time>
                      {' · '}
                      {n(batch.products_count, 'producto', 'productos')}, {n(batch.variants_count, 'variante', 'variantes')}
                    </p>
                    {(undone || isUndo) && (
                      <p className="mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70">
                          {isUndo ? 'Es un deshacer' : 'Deshecho'}
                        </span>
                      </p>
                    )}
                  </div>
                  {!isUndo && !undone && (
                    <button
                      type="button"
                      onClick={() => setUndoTarget(batch)}
                      aria-label={`Deshacer: ${summary}, del ${DATE.format(new Date(batch.created_at))}`}
                      className="self-start sm:self-auto inline-flex items-center justify-center gap-1.5 min-h-tap sm:min-h-9 px-3 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749]/30 dark:border-[#1CAAA8]/30 hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/10 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" aria-hidden="true" />
                      Deshacer
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Modal>

      {undoTarget && (
        <UndoPriceChangeDialog
          batchId={undoTarget.id}
          summary={describePriceChange(undoTarget.meta)}
          onClose={() => setUndoTarget(null)}
          onFinished={outcome => {
            onUndone(undoTarget.id, outcome)
            load()
          }}
        />
      )}
    </>
  )
}
