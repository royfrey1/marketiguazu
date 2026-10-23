import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Trash2, XCircle } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import BulkProgress from '../BulkProgress'
import type { BulkProductItem } from './BulkRestoreProductsDialog'
import { productsService, ProductAdminError } from '../../../services/products.service'

interface BulkArchiveProductsDialogProps {
  items: BulkProductItem[]
  onClose: () => void
  /**
   * Al terminar (también si se detuvo o hubo fallas): salen de la selección los enviados y los que ya no
   * están en esta lista (ya en la papelera o inexistentes); los demás quedan seleccionados
   */
  onFinished: (doneIds: number[]) => void
}

// Foco inicial: showModal() respeta el atributo autofocus
const autofocusRef = (el: HTMLElement | null) => el?.setAttribute('autofocus', '')

const productos = (n: number) => `${n.toLocaleString('es-AR')} ${n === 1 ? 'producto' : 'productos'}`

interface Failed {
  item: BulkProductItem
  error: ProductAdminError
}

type Phase = 'confirm' | 'running' | 'done'

/** Ya no pertenecen a la lista de Productos: no tiene sentido dejarlos seleccionados */
const isGone = (error: ProductAdminError) => error.key === 'ALREADY_IN_TRASH' || error.key === 'PRODUCT_NOT_FOUND'

export default function BulkArchiveProductsDialog({ items, onClose, onFinished }: BulkArchiveProductsDialogProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [progress, setProgress] = useState({ done: 0, current: '' })
  const [stopRequested, setStopRequested] = useState(false)
  const [result, setResult] = useState<{ archived: number; failed: Failed[]; skipped: BulkProductItem[] } | null>(null)
  const stopRef = useRef(false)
  const runningRef = useRef(false)
  const stopButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // El botón que se tocó desaparece al cambiar de fase: el foco pasa a Detener y después a Cerrar
  useEffect(() => {
    if (phase === 'running') stopButtonRef.current?.focus()
    else if (phase === 'done') closeButtonRef.current?.focus()
  }, [phase])

  const run = async () => {
    if (runningRef.current) return
    runningRef.current = true
    stopRef.current = false
    setPhase('running')
    const archivedIds: number[] = []
    const failed: Failed[] = []
    const skipped: BulkProductItem[] = []
    for (const [i, item] of items.entries()) {
      if (stopRef.current) {
        skipped.push(...items.slice(i))
        break
      }
      setProgress({ done: i, current: item.titulo })
      const { error } = await productsService.archive(item.id)
      if (error) failed.push({ item, error })
      else archivedIds.push(item.id)
    }
    setProgress({ done: items.length - skipped.length, current: '' })
    setResult({ archived: archivedIds.length, failed, skipped })
    setPhase('done')
    runningRef.current = false
    onFinished([...archivedIds, ...failed.filter(f => isGone(f.error)).map(f => f.item.id)])

    const notArchived = failed.length + skipped.length
    if (notArchived === 0) {
      sileo.success({
        title: archivedIds.length === 1 ? 'Producto enviado a la papelera' : `${productos(archivedIds.length)} enviados a la papelera`,
        description: 'Los podés restaurar desde la Papelera.',
      })
    } else {
      sileo.warning({
        title: archivedIds.length > 0 ? `Se enviaron ${archivedIds.length} de ${items.length} a la papelera` : 'No se envió ningún producto a la papelera',
        description: 'Revisá el resumen: los que no se enviaron siguen seleccionados.',
      })
    }
  }

  const stop = () => {
    stopRef.current = true
    setStopRequested(true)
  }

  const running = phase === 'running'
  const btnSecondary = 'min-h-11 sm:min-h-0 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!running}
      title={phase === 'done' ? 'Envío a la papelera terminado' : `Enviar ${productos(items.length)} a la papelera`}
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {phase === 'confirm' && (
            <>
              <button type="button" ref={autofocusRef} onClick={onClose} className={btnSecondary}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={run}
                className="min-h-11 sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Enviar a papelera
              </button>
            </>
          )}
          {running && (
            <button type="button" ref={stopButtonRef} onClick={stop} disabled={stopRequested} className={`${btnSecondary} border border-gray-200 dark:border-white/10`}>
              {stopRequested ? 'Deteniendo después del actual...' : 'Detener'}
            </button>
          )}
          {phase === 'done' && (
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              className="min-h-11 sm:min-h-0 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      }
    >
      {phase === 'confirm' && (
        <p className="text-sm text-gray-600 dark:text-white/60">
          Enviar {productos(items.length)} a la papelera: {items.length === 1 ? 'deja' : 'dejan'} de verse en la tienda.
          Los podés restaurar desde la Papelera ({items.length === 1 ? 'volverá como inactivo' : 'volverán como inactivos'}).
        </p>
      )}

      {running && (
        <BulkProgress
          label={`Enviando ${Math.min(progress.done + 1, items.length)} de ${items.length}...`}
          done={progress.done}
          total={items.length}
          current={progress.current}
        />
      )}

      {phase === 'done' && result && (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            Enviados: <strong className="tabular-nums">{result.archived}</strong>
          </p>
          {(result.failed.length > 0 || result.skipped.length > 0) && (
            <div>
              <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                No enviados: <strong className="tabular-nums">{result.failed.length + result.skipped.length}</strong>
              </p>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-2 rounded-lg border border-gray-200 dark:border-white/10 p-3">
                {result.failed.map(({ item, error }) => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-red-700 dark:text-red-400"><FriendlyError error={error} /></span>
                    {!isGone(error) && <span className="block text-gray-500 dark:text-white/40">Sigue seleccionado</span>}
                  </li>
                ))}
                {result.skipped.map(item => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-gray-500 dark:text-white/40">Detenido antes de procesarlo (sigue seleccionado)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
