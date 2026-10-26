import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Info, Loader2, RotateCcw } from 'lucide-react'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import PriceBatchProducts from '../products/PriceBatchProducts'
import type { UndoOutcome } from '../products/UndoPriceChangeDialog'
import {
  stockChangeService,
  type StockChangeError,
  type StockChangeUndoResult,
  type StockUndoSkipReason,
} from '../../../services/stockChange.service'

interface UndoStockChangeDialogProps {
  batchId: string
  /** Resumen del cambio, por ejemplo "Sumar 5 unidades" */
  summary?: string
  /** Títulos de los productos del lote (desde "Cambios recientes"); sin ellos queda el texto genérico */
  products?: string[]
  productsTotal?: number
  onClose: () => void
  onFinished: (outcome: UndoOutcome) => void
}

// Foco inicial: showModal() respeta el atributo autofocus
const autofocusRef = (el: HTMLElement | null) => el?.setAttribute('autofocus', '')

const n = (count: number, one: string, many: string) => `${count.toLocaleString('es-AR')} ${count === 1 ? one : many}`

const SKIP_LABELS: Record<StockUndoSkipReason, [one: string, many: string]> = {
  stock_insuficiente: ['1 fila no se tocó porque tiene unidades reservadas.', 'filas no se tocaron porque tienen unidades reservadas.'],
  stock_negativo: ['1 fila no se tocó porque ya no hay stock suficiente.', 'filas no se tocaron porque ya no hay stock suficiente.'],
  no_existe: ['1 fila ya no existe.', 'filas ya no existen.'],
}

type Phase = 'confirm' | 'running' | 'done'

export default function UndoStockChangeDialog({ batchId, summary, products = [], productsTotal = 0, onClose, onFinished }: UndoStockChangeDialogProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [result, setResult] = useState<StockChangeUndoResult | null>(null)
  const [error, setError] = useState<StockChangeError | null>(null)
  const runningRef = useRef(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (phase === 'running') statusRef.current?.focus()
    else if (phase === 'done') closeButtonRef.current?.focus()
  }, [phase])

  const run = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setPhase('running')
    const { data, error: undoError } = await stockChangeService.undoStockChangeBulk(batchId)
    runningRef.current = false
    setResult(data)
    setError(undoError)
    setPhase('done')
    if (undoError) onFinished(undoError.key === 'ALREADY_UNDONE' ? 'already' : 'failed')
    else onFinished(data?.batch_id ? 'restored' : 'nothing')
  }

  const running = phase === 'running'
  const skippedBy = (motivo: StockUndoSkipReason) => result?.skipped.filter(s => s.motivo === motivo).length ?? 0

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!running}
      title={phase === 'done' ? 'Deshacer cambio de stock' : '¿Deshacer el cambio de stock?'}
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {phase === 'confirm' && (
            <>
              <button
                type="button"
                ref={autofocusRef}
                onClick={onClose}
                className="min-h-tap sm:min-h-0 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={run}
                className="min-h-tap sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Deshacer
              </button>
            </>
          )}
          {running && (
            <button type="button" disabled className="min-h-tap sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] dark:bg-[#1CAAA8] text-white opacity-60 cursor-wait">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Deshaciendo...
            </button>
          )}
          {phase === 'done' && (
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              className="min-h-tap sm:min-h-0 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      }
    >
      {phase === 'confirm' && (
        <div className="space-y-2 text-sm text-gray-600 dark:text-white/60">
          <p>
            Se va a revertir ese cambio de stock sobre el stock actual: si hubo ventas o reservas después, esas unidades
            no se tocan.
          </p>
          {products.length > 0 && (
            <div>
              <p>Productos:</p>
              <PriceBatchProducts names={products} total={productsTotal} prefix="" className="text-gray-700 dark:text-white/70" />
            </div>
          )}
          {summary && <p className="text-gray-500 dark:text-white/40">Cambio: {summary}</p>}
        </div>
      )}

      {running && (
        <div ref={statusRef} tabIndex={-1} role="status" className="outline-none flex items-center gap-2 text-sm text-gray-700 dark:text-white/70">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Revirtiendo el cambio de stock...
        </div>
      )}

      {phase === 'done' && (
        <div role="status" className="space-y-2 text-sm text-gray-700 dark:text-white/70">
          {error ? (
            <p className="text-red-700 dark:text-red-400"><FriendlyError error={error} /></p>
          ) : result?.batch_id ? (
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Se restauró el stock de {n(result.restored, 'fila', 'filas')}.</span>
            </p>
          ) : (
            <p className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              No se pudo restaurar nada: ninguna fila se podía revertir sin pisar ventas o reservas.
            </p>
          )}
          {!error && (Object.keys(SKIP_LABELS) as StockUndoSkipReason[]).map(motivo => {
            const count = skippedBy(motivo)
            if (count === 0) return null
            const [one, many] = SKIP_LABELS[motivo]
            return (
              <p key={motivo} className="text-gray-600 dark:text-white/60">
                {count === 1 ? one : `${count.toLocaleString('es-AR')} ${many}`}
              </p>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
