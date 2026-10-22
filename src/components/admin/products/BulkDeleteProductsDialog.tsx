import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, Loader2, Trash2, XCircle } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import BulkProgress from '../BulkProgress'
import type { BulkProductItem } from './BulkRestoreProductsDialog'
import {
  productsService,
  ProductAdminError,
  type ProductDeleteInfo,
} from '../../../services/products.service'
import { productImagesService } from '../../../services/productImages.service'

interface BulkDeleteProductsDialogProps {
  items: BulkProductItem[]
  onClose: () => void
  /** Al terminar (también si se detuvo o hubo fallas): los eliminados salen de la selección; refrescar */
  onFinished: (deletedIds: number[]) => void
}

/** Revisión previa en paralelo, de a pocos para no saturar la API */
const INFO_CONCURRENCY = 4
const CONFIRM_WORD = 'ELIMINAR'

// Foco inicial: showModal() respeta el atributo autofocus
const autofocusRef = (el: HTMLElement | null) => el?.setAttribute('autofocus', '')

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es-AR')} ${n === 1 ? one : many}`

interface Deletable {
  item: BulkProductItem
  info: ProductDeleteInfo
}

interface Blocked {
  item: BulkProductItem
  reason: string
}

interface Failed {
  item: BulkProductItem
  error: ProductAdminError
}

type Phase = 'checking' | 'confirm' | 'running' | 'done'

/** Motivo por el que no se puede borrar (null = se puede) */
function blockReason(info: ProductDeleteInfo): string | null {
  if (!info.in_trash) return 'Ya no está en la papelera: recargá la lista'
  if (info.has_sales) return 'Tuvo ventas: solo puede quedar en la papelera'
  if (info.in_carts) return 'Está en carritos de clientes: intentalo más tarde'
  return null
}

/** El servidor rechazó el borrado: en el masivo el aviso de stock no habla de escribir el nombre */
function bulkDeleteError(error: ProductAdminError): ProductAdminError {
  if (error.key !== 'STOCK_CONFIRM_REQUIRED') return error
  return new ProductAdminError(error.key, 'El stock cambió desde la revisión: volvé a intentarlo.', error.code)
}

export default function BulkDeleteProductsDialog({ items, onClose, onFinished }: BulkDeleteProductsDialogProps) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [checked, setChecked] = useState(0)
  const [deletable, setDeletable] = useState<Deletable[]>([])
  const [blocked, setBlocked] = useState<Blocked[]>([])
  const [checkFailed, setCheckFailed] = useState<Failed[]>([])
  const [typed, setTyped] = useState('')
  const [progress, setProgress] = useState({ done: 0, current: '' })
  const [stopRequested, setStopRequested] = useState(false)
  const [result, setResult] = useState<{ deleted: number; failed: Failed[]; skipped: BulkProductItem[]; storageFailed: number } | null>(null)
  const stopRef = useRef(false)
  const runningRef = useRef(false)
  // Se cerró el modal durante la revisión: no seguir actualizando
  const closedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const stopButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // El botón que se tocó desaparece al cambiar de fase: el foco pasa a Detener y después a Cerrar
  useEffect(() => {
    if (phase === 'running') stopButtonRef.current?.focus()
    else if (phase === 'done') closeButtonRef.current?.focus()
  }, [phase])

  /** Revisa (get_admin_product_delete_info) los productos dados y los clasifica */
  const review = useCallback(async (toCheck: BulkProductItem[], isCancelled: () => boolean) => {
    const found: Deletable[] = []
    const blockedNow: Blocked[] = []
    const failedNow: Failed[] = []
    let next = 0
    const worker = async () => {
      while (next < toCheck.length && !isCancelled()) {
        const item = toCheck[next++]
        const { data, error } = await productsService.getDeleteInfo(item.id)
        if (error || !data) {
          failedNow.push({ item, error: error ?? new ProductAdminError('UNKNOWN', 'Sin respuesta del servidor', null) })
        } else {
          const reason = blockReason(data)
          const named = { ...item, titulo: data.titulo || item.titulo }
          if (reason) blockedNow.push({ item: named, reason })
          else found.push({ item: named, info: data })
        }
        if (!isCancelled()) setChecked(c => c + 1)
      }
    }
    await Promise.all(Array.from({ length: Math.min(INFO_CONCURRENCY, toCheck.length) }, worker))
    // Mismo orden que la selección
    const order = new Map(items.map((item, i) => [item.id, i]))
    const byOrder = <T extends { item: BulkProductItem }>(list: T[]) =>
      list.sort((a, b) => (order.get(a.item.id) ?? 0) - (order.get(b.item.id) ?? 0))
    return { found: byOrder(found), blockedNow: byOrder(blockedNow), failedNow: byOrder(failedNow) }
  }, [items])

  useEffect(() => {
    // Cada revisión inicial tiene su propia marca (StrictMode monta dos veces: la primera se descarta)
    let cancelled = false
    closedRef.current = false
    void review(items, () => cancelled).then(({ found, blockedNow, failedNow }) => {
      if (cancelled) return
      setDeletable(found)
      setBlocked(blockedNow)
      setCheckFailed(failedNow)
      setPhase('confirm')
    })
    return () => {
      cancelled = true
      closedRef.current = true
    }
  }, [items, review])

  // Reintentar solo los que no se pudieron revisar
  const retryReview = async () => {
    const toCheck = checkFailed.map(f => f.item)
    setChecked(items.length - toCheck.length)
    setPhase('checking')
    const { found, blockedNow, failedNow } = await review(toCheck, () => closedRef.current)
    if (closedRef.current) return
    const order = new Map(items.map((item, i) => [item.id, i]))
    const sortBy = <T extends { item: BulkProductItem }>(list: T[]) =>
      list.sort((a, b) => (order.get(a.item.id) ?? 0) - (order.get(b.item.id) ?? 0))
    setDeletable(prev => sortBy([...prev, ...found]))
    setBlocked(prev => sortBy([...prev, ...blockedNow]))
    setCheckFailed(failedNow)
    setPhase('confirm')
  }

  const totals = deletable.reduce(
    (acc, { info }) => ({
      stock: acc.stock + (info.stock_total ?? 0),
      variants: acc.variants + (info.variant_count ?? 0),
      images: acc.images + (info.image_count ?? 0),
    }),
    { stock: 0, variants: 0, images: 0 }
  )
  const needsWord = totals.stock > 0
  const wordOk = typed.trim().toUpperCase() === CONFIRM_WORD
  const canDelete = phase === 'confirm' && deletable.length > 0 && (!needsWord || wordOk)

  useEffect(() => {
    if (phase === 'confirm' && needsWord && deletable.length > 0) inputRef.current?.focus()
  }, [phase, needsWord, deletable.length])

  const run = async () => {
    if (!canDelete || runningRef.current) return
    runningRef.current = true
    stopRef.current = false
    setPhase('running')
    const deletedIds: number[] = []
    const failed: Failed[] = []
    const skipped: BulkProductItem[] = []
    let storageFailed = 0
    for (const [i, { item, info }] of deletable.entries()) {
      if (stopRef.current) {
        skipped.push(...deletable.slice(i).map(d => d.item))
        break
      }
      setProgress({ done: i, current: item.titulo })
      const stock = info.stock_total ?? 0
      const { data, error } = await productsService.deletePermanent(item.id, stock > 0)
      if (error || !data) {
        failed.push({ item, error: bulkDeleteError(error ?? new ProductAdminError('UNKNOWN', 'Sin respuesta del servidor', null)) })
        continue
      }
      deletedIds.push(item.id)
      // La base ya lo borró: si fallan imágenes se cuenta, no es una falla del producto
      const { failed: filesFailed } = await productImagesService.removeStorageFiles(data.storage_files ?? [])
      storageFailed += filesFailed
    }
    setProgress({ done: deletable.length - skipped.length, current: '' })
    setResult({ deleted: deletedIds.length, failed, skipped, storageFailed })
    setPhase('done')
    runningRef.current = false
    onFinished(deletedIds)

    const notDeleted = failed.length + skipped.length
    if (notDeleted === 0 && storageFailed === 0) {
      sileo.success({ title: deletedIds.length === 1 ? 'Producto eliminado definitivamente' : `${plural(deletedIds.length, 'producto eliminado', 'productos eliminados')} definitivamente` })
    } else {
      sileo.warning({
        title: `Se eliminaron ${deletedIds.length} de ${deletable.length}`,
        description: storageFailed > 0
          ? `${plural(storageFailed, 'imagen no pudo borrarse', 'imágenes no pudieron borrarse')} del almacenamiento.`
          : 'Revisá el resumen: los que no se eliminaron siguen seleccionados.',
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
      title={phase === 'done' ? 'Eliminación terminada' : `Eliminar definitivamente ${plural(items.length, 'producto', 'productos')}`}
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {(phase === 'checking' || phase === 'confirm') && (
            <>
              <button type="button" ref={autofocusRef} onClick={onClose} className={btnSecondary}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={run}
                disabled={!canDelete}
                className="min-h-11 sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {phase === 'confirm' && deletable.length > 0 ? `Eliminar ${plural(deletable.length, 'producto', 'productos')}` : 'Eliminar'}
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
      {phase === 'checking' && (
        <div role="status" className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Revisando {plural(items.length, 'producto', 'productos')}... ({checked} de {items.length})
          </p>
        </div>
      )}

      {phase === 'confirm' && (
        <div className="space-y-4 text-sm">
          {deletable.length > 0 ? (
            <>
              <p className="text-gray-700 dark:text-white/70">
                Se eliminarán <strong>{plural(deletable.length, 'producto', 'productos')}</strong>:{' '}
                {plural(totals.variants, 'variante', 'variantes')}, {plural(totals.images, 'imagen', 'imágenes')}.{' '}
                Stock que se perderá: <strong>{plural(totals.stock, 'unidad', 'unidades')}</strong>.
              </p>
              <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                {deletable.map(({ item, info }) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 text-gray-800 dark:text-white/80 break-words">
                      {item.titulo} <span className="text-gray-400 dark:text-white/30 whitespace-nowrap">(ID {item.id})</span>
                    </span>
                    <span className={`shrink-0 text-xs tabular-nums ${info.stock_total > 0 ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-white/30'}`}>
                      {plural(info.stock_total ?? 0, 'unidad', 'unidades')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4" role="alert">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-amber-800 dark:text-amber-300">
                Ninguno de los seleccionados se puede eliminar definitivamente. Revisá los motivos abajo.
              </p>
            </div>
          )}

          {blocked.length > 0 && (
            <div>
              <p className="flex items-center gap-2 font-medium text-gray-700 dark:text-white/70">
                <Ban className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                No se pueden eliminar ({blocked.length}): quedan afuera
              </p>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-1.5 rounded-lg border border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                {blocked.map(({ item, reason }) => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-amber-800 dark:text-amber-300">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkFailed.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-3" role="alert">
              <p className="font-medium text-red-700 dark:text-red-400">
                {checkFailed.length === 1 ? 'No se pudo revisar 1 producto' : `No se pudieron revisar ${plural(checkFailed.length, 'producto', 'productos')}`}: quedan afuera hasta revisarlos.
              </p>
              <ul className="mt-1 space-y-1 text-red-700 dark:text-red-400">
                {checkFailed.map(({ item, error }) => (
                  <li key={item.id}>
                    <span className="font-medium break-words">{item.titulo}</span> (ID {item.id}): <FriendlyError error={error} />
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void retryReview()}
                className="mt-2 min-h-11 sm:min-h-0 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] hover:underline cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {deletable.length > 0 && (needsWord ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="font-medium text-red-700 dark:text-red-400">
                  Se perderán {plural(totals.stock, 'unidad', 'unidades')} en stock. Esta acción no se puede deshacer.
                </p>
              </div>
              <div>
                <label htmlFor="bulk-delete-confirm" className="block text-gray-700 dark:text-white/70 mb-1.5">
                  Para confirmar, escribí <strong className="text-gray-800 dark:text-white/80">{CONFIRM_WORD}</strong>
                </label>
                <input
                  id="bulk-delete-confirm"
                  ref={inputRef}
                  type="text"
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void run() } }}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full min-h-11 sm:min-h-0 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            <p className="font-medium text-gray-700 dark:text-white/70">Esta acción no se puede deshacer.</p>
          ))}
        </div>
      )}

      {running && (
        <BulkProgress
          label={`Eliminando ${Math.min(progress.done + 1, deletable.length)} de ${deletable.length}...`}
          done={progress.done}
          total={deletable.length}
          current={progress.current}
        />
      )}

      {phase === 'done' && result && (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            Eliminados: <strong className="tabular-nums">{result.deleted}</strong>
          </p>
          {(result.failed.length > 0 || result.skipped.length > 0 || blocked.length > 0 || checkFailed.length > 0) && (
            <div>
              <p className="flex items-center gap-2 text-gray-700 dark:text-white/70">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                No eliminados: <strong className="tabular-nums">{result.failed.length + result.skipped.length + blocked.length + checkFailed.length}</strong>
                <span className="text-gray-500 dark:text-white/40">(siguen seleccionados)</span>
              </p>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-2 rounded-lg border border-gray-200 dark:border-white/10 p-3">
                {result.failed.map(({ item, error }) => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-red-700 dark:text-red-400"><FriendlyError error={error} /></span>
                  </li>
                ))}
                {result.skipped.map(item => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-gray-500 dark:text-white/40">Detenido antes de procesarlo</span>
                  </li>
                ))}
                {blocked.map(({ item, reason }) => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-amber-800 dark:text-amber-300">{reason}</span>
                  </li>
                ))}
                {checkFailed.map(({ item }) => (
                  <li key={item.id} className="text-gray-600 dark:text-white/60">
                    <span className="font-medium text-gray-800 dark:text-white/80 break-words">{item.titulo}</span>{' '}
                    <span className="text-gray-400 dark:text-white/30">(ID {item.id})</span>
                    <span className="block text-gray-500 dark:text-white/40">No se pudo revisar</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.storageFailed > 0 && (
            <p className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              {plural(result.storageFailed, 'imagen no pudo borrarse', 'imágenes no pudieron borrarse')} del almacenamiento.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
