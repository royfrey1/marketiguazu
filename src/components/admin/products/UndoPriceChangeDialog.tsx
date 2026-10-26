import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Info, Loader2, RotateCcw } from 'lucide-react'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import PriceBatchProducts from './PriceBatchProducts'
import {
  priceChangeService,
  type PriceChangeError,
  type PriceChangeUndoResult,
} from '../../../services/priceChange.service'

/**
 * restored: se devolvió al menos un precio | nothing: no se pudo restaurar nada (el lote sigue sin deshacer)
 * already: el cambio ya estaba deshecho | failed: error (no se sabe si cambió algo: el lote sigue igual)
 */
export type UndoOutcome = 'restored' | 'nothing' | 'already' | 'failed'

interface UndoPriceChangeDialogProps {
  batchId: string
  /** Resumen del cambio, por ejemplo "Subir 10% · redondeo a $100" */
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

type Phase = 'confirm' | 'running' | 'done'

export default function UndoPriceChangeDialog({ batchId, summary, products = [], productsTotal = 0, onClose, onFinished }: UndoPriceChangeDialogProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [result, setResult] = useState<PriceChangeUndoResult | null>(null)
  const [error, setError] = useState<PriceChangeError | null>(null)
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
    const { data, error: undoError } = await priceChangeService.undoPriceChangeBulk(batchId)
    runningRef.current = false
    setResult(data)
    setError(undoError)
    setPhase('done')
    if (undoError) onFinished(undoError.key === 'ALREADY_UNDONE' ? 'already' : 'failed')
    else onFinished(data?.batch_id ? 'restored' : 'nothing')
  }

  const running = phase === 'running'
  const changedLater = result?.skipped.filter(s => s.motivo === 'precio_cambiado').length ?? 0
  const gone = result?.skipped.filter(s => s.motivo === 'no_existe').length ?? 0

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!running}
      title={phase === 'done' ? 'Deshacer cambio de precios' : '¿Deshacer el cambio de precios?'}
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
          {products.length > 0 ? (
            <div>
              <p>Se van a devolver los precios anteriores de:</p>
              <PriceBatchProducts names={products} total={productsTotal} prefix="" className="text-gray-700 dark:text-white/70" />
            </div>
          ) : <p>Se van a devolver los precios anteriores.</p>}
          {summary && <p className="text-gray-500 dark:text-white/40">Cambio: {summary}</p>}
          <p className="text-gray-500 dark:text-white/40">Los precios que se cambiaron después no se tocan.</p>
        </div>
      )}

      {running && (
        <div ref={statusRef} tabIndex={-1} role="status" className="outline-none flex items-center gap-2 text-sm text-gray-700 dark:text-white/70">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Devolviendo los precios anteriores...
        </div>
      )}

      {phase === 'done' && (
        <div role="status" className="space-y-2 text-sm text-gray-700 dark:text-white/70">
          {error ? (
            <p className="text-red-700 dark:text-red-400"><FriendlyError error={error} /></p>
          ) : result?.batch_id ? (
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span>
                Se restauraron los precios de {n(result.restored_products, 'producto', 'productos')}
                {result.restored_variants > 0 && ` y ${n(result.restored_variants, 'variante', 'variantes')}`}.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              No se pudo restaurar nada: todos esos precios se cambiaron después o ya no existen.
            </p>
          )}
          {!error && changedLater > 0 && (
            <p className="text-gray-600 dark:text-white/60">
              {changedLater === 1
                ? '1 precio no se tocó porque se cambió después.'
                : `${changedLater.toLocaleString('es-AR')} precios no se tocaron porque se cambiaron después.`}
            </p>
          )}
          {!error && gone > 0 && (
            <p className="text-gray-600 dark:text-white/60">
              {gone === 1 ? '1 producto o variante ya no existe.' : `${gone.toLocaleString('es-AR')} productos o variantes ya no existen.`}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
