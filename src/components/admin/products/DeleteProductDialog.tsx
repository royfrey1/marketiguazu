import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../../ui/Modal'
import { productsService, type ProductAdminRow, type ProductDeleteInfo } from '../../../services/products.service'
import { productImagesService } from '../../../services/productImages.service'

interface DeleteProductDialogProps {
  product: ProductAdminRow
  onClose: () => void
  /** Ya borrado (la base; las imágenes pudieron fallar): refrescar la lista y el contador */
  onDeleted: () => void
}

// Foco inicial: showModal() respeta el atributo autofocus (el autoFocus de React no llega a un <dialog> cerrado)
const autofocusRef = (el: HTMLElement | null) => el?.setAttribute('autofocus', '')

/** Mismo nombre ignorando mayúsculas/minúsculas y espacios sobrantes en los extremos */
const sameName = (typed: string, titulo: string) => typed.trim().toLowerCase() === titulo.trim().toLowerCase()

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es-AR')} ${n === 1 ? one : many}`

export default function DeleteProductDialog({ product, onClose, onDeleted }: DeleteProductDialogProps) {
  const [info, setInfo] = useState<ProductDeleteInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typedName, setTypedName] = useState('')
  const deletingRef = useRef(false)
  // Esc cierra el <dialog> nativo aunque se esté borrando: al terminar se avisa y se cierra
  const closedWhileDeletingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchInfo = useCallback(
    () => productsService.getDeleteInfo(product.id).then(({ data, error }) => {
      setInfo(data)
      setInfoError(error ? error.message : null)
      setLoadingInfo(false)
    }),
    [product.id]
  )

  useEffect(() => {
    void fetchInfo()
  }, [fetchInfo])

  // Reintentar, o volver a leer el resumen si el servidor rechazó el borrado
  const loadInfo = () => {
    setLoadingInfo(true)
    setInfoError(null)
    return fetchInfo()
  }

  const titulo = info?.titulo ?? product.titulo
  const stock = info?.stock_total ?? 0
  const blockedMessage = !info
    ? null
    : !info.in_trash
      ? 'El producto no está en la papelera. Recargá la lista.'
      : info.has_sales
        ? 'Este producto tuvo ventas: no se puede eliminar definitivamente. Queda en la papelera para conservar el historial.'
        : info.in_carts
          ? 'Este producto está en carritos de clientes. Intentalo de nuevo más tarde.'
          : null
  const needsName = !!info && !blockedMessage && stock > 0
  useEffect(() => {
    if (needsName) inputRef.current?.focus()
  }, [needsName])

  const canDelete = !!info && !blockedMessage && !deleting && (!needsName || sameName(typedName, titulo))

  const handleDelete = async () => {
    if (!info || !canDelete || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setDeleteError(null)
    const { data, error } = await productsService.deletePermanent(product.id, stock > 0)
    if (error || !data) {
      deletingRef.current = false
      setDeleting(false)
      const message = error?.message ?? 'No se pudo eliminar el producto. Intentá de nuevo.'
      if (closedWhileDeletingRef.current) {
        sileo.error({ title: 'No se pudo eliminar el producto', description: message })
        onClose()
        return
      }
      setDeleteError(message)
      // Cambió algo en el servidor (ventas, carritos, stock): se vuelve a leer el resumen
      if (error && ['HAS_SALES', 'IN_CARTS', 'STOCK_CONFIRM_REQUIRED', 'NOT_IN_TRASH'].includes(error.key)) {
        void loadInfo()
      }
      return
    }

    // La base ya lo borró: si fallan imágenes es un aviso, no una falla
    const { failed } = await productImagesService.removeStorageFiles(data.storage_files ?? [])
    if (failed > 0) {
      sileo.warning({
        title: 'Producto eliminado',
        description: `Se eliminó el producto, pero ${plural(failed, 'imagen no pudo borrarse', 'imágenes no pudieron borrarse')} del almacenamiento.`,
      })
    } else {
      sileo.success({ title: 'Producto eliminado definitivamente', description: data.titulo || titulo })
    }
    onDeleted()
  }

  return (
    <Modal
      open
      onClose={() => {
        if (deletingRef.current) closedWhileDeletingRef.current = true
        else onClose()
      }}
      title="Eliminar definitivamente"
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <button
            type="button"
            ref={autofocusRef}
            onClick={onClose}
            disabled={deleting}
            className="min-h-11 sm:min-h-0 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="min-h-11 sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
          </button>
        </div>
      }
    >
      {loadingInfo && !info ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-white/40" role="status">
          <Loader2 className="w-4 h-4 animate-spin" />
          Revisando el producto...
        </div>
      ) : infoError && !info ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4" role="alert">
          <p className="text-sm text-red-700 dark:text-red-400">No se pudo revisar el producto: {infoError}</p>
          <button
            type="button"
            onClick={() => void loadInfo()}
            className="mt-2 min-h-11 sm:min-h-0 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] hover:underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : info && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-white/60">
            <strong className="text-gray-800 dark:text-white/80 break-words">{titulo}</strong> (ID {product.id}) se borra para siempre,
            con todo lo que tiene:
          </p>

          <ul className="text-sm text-gray-600 dark:text-white/60 space-y-0.5">
            <li>• {plural(info.variant_count, 'variante', 'variantes')}</li>
            <li>• {plural(info.image_count, 'imagen', 'imágenes')}</li>
            <li>• {plural(stock, 'unidad en stock', 'unidades en stock')}</li>
            {info.favorites_count !== null && (
              <li>• En favoritos: {plural(info.favorites_count, 'cliente', 'clientes')}</li>
            )}
          </ul>

          {blockedMessage ? (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4" role="alert">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm text-amber-800 dark:text-amber-300">{blockedMessage}</p>
            </div>
          ) : needsName ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Tiene {plural(stock, 'unidad', 'unidades')} en stock que se perderán. Esta acción no se puede deshacer.
                </p>
              </div>
              <div>
                <label htmlFor="delete-product-name" className="block text-sm text-gray-700 dark:text-white/70 mb-1.5">
                  Para confirmar, escribí el nombre del producto:{' '}
                  <strong className="text-gray-800 dark:text-white/80 break-words">{titulo}</strong>
                </label>
                <input
                  id="delete-product-name"
                  ref={inputRef}
                  type="text"
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleDelete() } }}
                  disabled={deleting}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full min-h-11 sm:min-h-0 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-700 dark:text-white/70">Esta acción no se puede deshacer.</p>
          )}

          {deleteError && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {deleteError}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
