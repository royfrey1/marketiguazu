import { AlertTriangle, Loader2 } from 'lucide-react'
import type { Category } from '../../../services/categories.service'
import Modal from '../../ui/Modal'

interface DeleteCategoryDialogProps {
  category: Category
  productCount: number
  childCount: number
  onConfirm: () => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function DeleteCategoryDialog({
  category,
  productCount,
  childCount,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteCategoryDialogProps) {
  const hasDependencies = productCount > 0 || childCount > 0

  return (
    <Modal
      open
      onClose={onCancel}
      title="Eliminar categoría"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 cursor-pointer"
          >
            Cancelar
          </button>
          {hasDependencies && productCount > 0 ? (
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Desactivar en su lugar
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
        </div>
      }
    >
      <p className="text-sm text-gray-600 dark:text-white/60">
        ¿Estás seguro de que deseas eliminar la categoría{' '}
        <strong className="text-gray-800 dark:text-white/80">
          {category.icono ? `${category.icono} ` : ''}{category.nombre}
        </strong>?
      </p>

      {hasDependencies && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
                Esta categoría tiene dependencias:
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-400/80 space-y-0.5">
                {productCount > 0 && (
                  <li>• {productCount} {productCount === 1 ? 'producto asociado' : 'productos asociados'}</li>
                )}
                {childCount > 0 && (
                  <li>• {childCount} {childCount === 1 ? 'subcategoría hija' : 'subcategorías hijas'}</li>
                )}
              </ul>
              <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-2">
                {productCount > 0
                  ? 'No se puede eliminar una categoría con productos. Desactivarla en su lugar.'
                  : 'Las subcategorías hijas quedarán como categorías raíz.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
