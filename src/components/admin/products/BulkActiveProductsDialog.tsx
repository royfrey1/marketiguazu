import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Info, Loader2, MinusCircle, XCircle } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import BulkProgress from '../BulkProgress'
import type { BulkProductItem } from './BulkRestoreProductsDialog'
import { productsService, toProductAdminError, ProductAdminError } from '../../../services/products.service'

/** activo: el estado conocido al seleccionar (undefined = desconocido, se manda igual) */
export type BulkActiveItem = BulkProductItem & { activo?: boolean }

interface BulkActiveProductsDialogProps {
  /** true = Activar, false = Desactivar */
  activo: boolean
  items: BulkActiveItem[]
  onClose: () => void
  /**
   * Al terminar (también si hubo fallas): salen de la selección los cambiados, los que ya estaban así y los
   * que ya no están en esta lista (no existen o están en la papelera); los demás fallidos quedan
   */
  onFinished: (doneIds: number[]) => void
}

/** Un UPDATE por tanda de hasta 100 ids (la URL de .in() no crece sin límite) */
const BATCH_SIZE = 100

// Foco inicial: showModal() respeta el atributo autofocus
const autofocusRef = (el: HTMLElement | null) => el?.setAttribute('autofocus', '')

const productos = (n: number) => `${n.toLocaleString('es-AR')} ${n === 1 ? 'producto' : 'productos'}`

interface Failed {
  item: BulkActiveItem
  error: ProductAdminError
}

type Phase = 'confirm' | 'running' | 'done'

/** Ya no pertenecen a la lista de Productos: no tiene sentido dejarlos seleccionados */
const isGone = (error: ProductAdminError) => error.key === 'PRODUCT_NOT_FOUND' || error.key === 'PRODUCT_IN_TRASH'

export default function BulkActiveProductsDialog({ activo, items, onClose, onFinished }: BulkActiveProductsDialogProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [progress, setProgress] = useState({ done: 0, upTo: 0, current: '' })
  const [result, setResult] = useState<{ changed: number; failed: Failed[] } | null>(null)
  const runningRef = useRef(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Los que ya están en el estado pedido se saltean
  const toChange = items.filter(item => item.activo !== activo)
  const already = items.length - toChange.length

  const verb = activo ? 'Activar' : 'Desactivar'
  const estado = (n: number) => (activo ? (n === 1 ? 'activo' : 'activos') : (n === 1 ? 'inactivo' : 'inactivos'))
  const yaEstaban = (n: number) => `${n.toLocaleString('es-AR')} ya ${n === 1 ? 'estaba' : 'estaban'} ${estado(n)}`

  // El botón que se tocó desaparece al cambiar de fase: el foco pasa al progreso y después a Cerrar
  useEffect(() => {
    if (phase === 'running') progressRef.current?.focus()
    else if (phase === 'done') closeButtonRef.current?.focus()
  }, [phase])

  const run = async () => {
    if (runningRef.current || toChange.length === 0) return
    runningRef.current = true
    setPhase('running')
    const changedIds: number[] = []
    const failed: Failed[] = []

    for (let start = 0; start < toChange.length; start += BATCH_SIZE) {
      const batch = toChange.slice(start, start + BATCH_SIZE)
      setProgress({ done: start, upTo: start + batch.length, current: '' })
      const { data, error } = await productsService.setActiveMany(batch.map(item => item.id), activo)

      if (error) {
        // La tanda falló entera (por ejemplo, uno solo viola una regla): de a uno, como el botón individual,
        // para cambiar los que se puedan y saber el motivo de cada falla
        for (const [i, item] of batch.entries()) {
          setProgress({ done: start + i, upTo: start + i + 1, current: item.titulo })
          const { error: itemError } = await productsService.toggleActive(item.id, activo)
          if (itemError) failed.push({ item, error: toProductAdminError(itemError) })
          else changedIds.push(item.id)
        }
        continue
      }

      // Se verifica la cantidad de filas: las que faltan no se actualizaron
      const updated = new Set(data)
      for (const item of batch) {
        if (updated.has(item.id)) changedIds.push(item.id)
        else failed.push({ item, error: toProductAdminError({ code: 'P4004' }) })
      }
    }

    setProgress({ done: toChange.length, upTo: toChange.length, current: '' })
    setResult({ changed: changedIds.length, failed })
    setPhase('done')
    runningRef.current = false

    const alreadyIds = items.filter(item => item.activo === activo).map(item => item.id)
    const goneIds = failed.filter(f => isGone(f.error)).map(f => f.item.id)
    onFinished([...changedIds, ...alreadyIds, ...goneIds])

    const hecho = activo ? 'activados' : 'desactivados'
    if (failed.length === 0) {
      sileo.success({
        title: changedIds.length === 1 ? `Producto ${activo ? 'activado' : 'desactivado'}` : `${productos(changedIds.length)} ${hecho}`,
        description: activo ? 'Ya se ven en la tienda.' : 'Ya no se ven en la tienda.',
      })
    } else {
      sileo.warning({
        title: changedIds.length > 0
          ? `Se ${activo ? 'activaron' : 'desactivaron'} ${changedIds.length} de ${toChange.length}`
          : `No se ${activo ? 'activó' : 'desactivó'} ningún producto`,
        description: `${productos(failed.length)} no se ${failed.length === 1 ? 'pudo' : 'pudieron'} cambiar: revisá el resumen.`,
      })
    }
  }

  const running = phase === 'running'
  const Icon = activo ? Eye : EyeOff

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!running}
      title={phase === 'done' ? `${activo ? 'Activación' : 'Desactivación'} terminada` : `${verb} ${productos(items.length)}`}
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
                disabled={toChange.length === 0}
                className="min-h-11 sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {toChange.length > 0 ? `${verb} ${productos(toChange.length)}` : verb}
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
              {activo ? 'Activando...' : 'Desactivando...'}
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
        <div className="space-y-3 text-sm text-gray-600 dark:text-white/60">
          {toChange.length > 0 ? (
            <p>
              {productos(toChange.length)}{' '}
              {activo
                ? (toChange.length === 1 ? 'pasará a verse en la tienda.' : 'pasarán a verse en la tienda.')
                : (toChange.length === 1 ? 'dejará de verse en la tienda.' : 'dejarán de verse en la tienda.')}
            </p>
          ) : (
            <p className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              {items.length === 1
                ? `El producto seleccionado ya está ${estado(1)}: no hay nada para cambiar.`
                : `Los ${items.length.toLocaleString('es-AR')} productos seleccionados ya están ${estado(2)}: no hay nada para cambiar.`}
            </p>
          )}
          {already > 0 && toChange.length > 0 && (
            <p className="flex items-start gap-2 text-gray-500 dark:text-white/40">
              <MinusCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              {yaEstaban(already)}: se saltean.
            </p>
          )}
        </div>
      )}

      {running && (
        <div ref={progressRef} tabIndex={-1} className="outline-none">
          <BulkProgress
            label={`${activo ? 'Activando' : 'Desactivando'} ${progress.upTo} de ${toChange.length}...`}
            done={progress.done}
            total={toChange.length}
            current={progress.current}
          />
        </div>
      )}

      {phase === 'done' && result && (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            {activo ? 'Activados' : 'Desactivados'}: <strong className="tabular-nums">{result.changed}</strong>
          </p>
          {already > 0 && (
            <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
              <MinusCircle className="w-4 h-4 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
              Ya {already === 1 ? 'estaba' : 'estaban'} {estado(already)}: <strong className="tabular-nums">{already}</strong>
            </p>
          )}
          {result.failed.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                Fallaron: <strong className="tabular-nums">{result.failed.length}</strong>
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
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
