import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import BulkProgress from '../BulkProgress'
import { productsService, type ProductAdminError } from '../../../services/products.service'

export interface BulkProductItem {
  id: number
  titulo: string
}

interface BulkRestoreProductsDialogProps {
  items: BulkProductItem[]
  onClose: () => void
  /** Al terminar (también si hubo fallas): los restaurados salen de la selección; refrescar lista y contador */
  onFinished: (restoredIds: number[]) => void
}

// Foco inicial: showModal() respeta el atributo autofocus
const autofocusRef = (el: HTMLElement | null) => el?.setAttribute('autofocus', '')

const productos = (n: number) => `${n.toLocaleString('es-AR')} ${n === 1 ? 'producto' : 'productos'}`

type Phase = 'confirm' | 'running' | 'done'

export default function BulkRestoreProductsDialog({ items, onClose, onFinished }: BulkRestoreProductsDialogProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [progress, setProgress] = useState({ done: 0, current: '' })
  const [restored, setRestored] = useState<number[]>([])
  const [failed, setFailed] = useState<{ item: BulkProductItem; error: ProductAdminError }[]>([])
  const runningRef = useRef(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // El botón que se tocó desaparece al cambiar de fase: el foco pasa al progreso y después a Cerrar
  useEffect(() => {
    if (phase === 'running') progressRef.current?.focus()
    else if (phase === 'done') closeButtonRef.current?.focus()
  }, [phase])

  const run = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setPhase('running')
    const ok: number[] = []
    const errors: { item: BulkProductItem; error: ProductAdminError }[] = []
    for (const [i, item] of items.entries()) {
      setProgress({ done: i, current: item.titulo })
      const { error } = await productsService.restore(item.id)
      if (error) errors.push({ item, error })
      else ok.push(item.id)
    }
    setProgress({ done: items.length, current: '' })
    setRestored(ok)
    setFailed(errors)
    setPhase('done')
    runningRef.current = false
    onFinished(ok)

    if (errors.length === 0) {
      sileo.success({
        title: ok.length === 1 ? 'Producto restaurado' : `${productos(ok.length)} restaurados`,
        description: 'Quedaron inactivos: activalos cuando quieras.',
      })
    } else {
      sileo.warning({
        title: ok.length > 0 ? `Se restauraron ${ok.length} de ${items.length}` : 'No se restauró ningún producto',
        description: `${productos(errors.length)} no se pudieron restaurar: siguen seleccionados para reintentar.`,
      })
    }
  }

  const running = phase === 'running'

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!running}
      title={phase === 'done' ? 'Restauración terminada' : `Restaurar ${productos(items.length)}`}
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {phase === 'confirm' && (
            <>
              <button
                type="button"
                ref={autofocusRef}
                onClick={onClose}
                className="min-h-11 sm:min-h-0 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={run}
                className="min-h-11 sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Restaurar {productos(items.length)}
              </button>
            </>
          )}
          {running && (
            <button
              type="button"
              disabled
              className="min-h-11 sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] dark:bg-[#1CAAA8] text-white opacity-60 cursor-wait"
            >
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Restaurando...
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
          Restaurar {productos(items.length)}. Quedarán inactivos: activalos cuando quieras.
        </p>
      )}

      {running && (
        <div ref={progressRef} tabIndex={-1} className="outline-none">
        <BulkProgress
          label={`Restaurando ${Math.min(progress.done + 1, items.length)} de ${items.length}...`}
          done={progress.done}
          total={items.length}
          current={progress.current}
        />
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            Restaurados: <strong className="tabular-nums">{restored.length}</strong>
            {restored.length > 0 && <span className="text-gray-500 dark:text-white/40">(quedaron inactivos)</span>}
          </p>
          {failed.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                No restaurados: <strong className="tabular-nums">{failed.length}</strong>
              </p>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-2 rounded-lg border border-gray-200 dark:border-white/10 p-3">
                {failed.map(({ item, error }) => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-red-700 dark:text-red-400"><FriendlyError error={error} /></span>
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
