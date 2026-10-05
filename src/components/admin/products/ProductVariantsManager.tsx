import { useState, useEffect } from 'react'
import { Plus, Loader2, Package, Layers, EyeOff } from 'lucide-react'
import {
  productVariantsService,
  type VariantWithInventory,
  type VariantFormData,
} from '../../../services/productVariants.service'
import {
  productImagesService,
  type VariantImageSummary,
} from '../../../services/productImages.service'
import VariantFormDialog from './VariantFormDialog'
import PriceHistoryDialog from './PriceHistoryDialog'
import VariantCombinationGenerator from './VariantCombinationGenerator'
import VariantRow, { VariantListHeader } from './VariantRow'
import Modal from '../../ui/Modal'

interface ProductVariantsManagerProps {
  productId: number
}

interface EditingVariantData extends VariantFormData {
  id: number
}

export default function ProductVariantsManager({ productId }: ProductVariantsManagerProps) {
  const [variants, setVariants] = useState<VariantWithInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [editingVariant, setEditingVariant] = useState<EditingVariantData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null)
  const [deletingVariant, setDeletingVariant] = useState<VariantWithInventory | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [historyVariant, setHistoryVariant] = useState<VariantWithInventory | null>(null)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [inactiveOpen, setInactiveOpen] = useState(false)
  // Galerías propias de cada variante (cantidad + foto principal), en una sola consulta por producto
  const [imageSummary, setImageSummary] = useState<Map<number, VariantImageSummary>>(new Map())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      const [{ data, error: fetchError }, { data: summary }] = await Promise.all([
        productVariantsService.getByProductId(productId),
        productImagesService.getVariantImageSummary(productId),
      ])
      if (!cancelled) {
        // Si el resumen falla llega vacío: la lista cae a imagen_url, no se rompe
        setImageSummary(summary)
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setVariants(data || [])
          // Si ya no quedan inactivas (p. ej. se activó la última desde el modal), cerrarlo
          if (!(data || []).some(v => !v.activo)) setInactiveOpen(false)
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [productId, refreshKey])

  // Las fotos de una variante se guardan al subirlas, sin pasar por "Guardar cambios":
  // al cerrar el diálogo (aun con "Cancelar") se refresca el resumen de la lista.
  const refreshImageSummary = async () => {
    const { data, error } = await productImagesService.getVariantImageSummary(productId)
    if (!error) setImageSummary(data)
  }

  const handleCreate = () => {
    setEditingVariant(null)
    setDialogMode('create')
    setSaveError(null)
  }

  const handleEdit = (variant: VariantWithInventory) => {
    setEditingVariant({
      sku: variant.sku,
      nombre: variant.nombre,
      precio: variant.precio,
      precio_anterior: variant.precio_anterior,
      atributos: (variant.atributos as Record<string, string>) || null,
      imagen_url: variant.imagen_url,
      activo: variant.activo,
      id: variant.id,
    })
    setDialogMode('edit')
    setSaveError(null)
  }

  const handleConfirm = async (data: VariantFormData) => {
    setSaving(true)
    setSaveError(null)
    try {
      let result
      if (dialogMode === 'create') {
        result = await productVariantsService.create(productId, data)
      } else if (dialogMode === 'edit' && editingVariant?.id) {
        result = await productVariantsService.update(editingVariant.id, data)
      }
      if (result?.error) throw result.error
      setDialogMode(null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (variant: VariantWithInventory) => {
    setDeleteLoading(variant.id)
    try {
      const { error } = await productVariantsService.toggleActive(variant.id, !variant.activo)
      if (error) throw error
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleDelete = (variant: VariantWithInventory) => {
    setDeletingVariant(variant)
  }

  const confirmDelete = async () => {
    if (!deletingVariant) return
    setDeleteLoading(deletingVariant.id)
    try {
      const { error } = await productVariantsService.remove(deletingVariant.id)
      if (error) throw error
      setDeletingVariant(null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeleteLoading(null)
    }
  }

  const activeVariants = variants.filter(v => v.activo)
  const inactiveVariants = variants.filter(v => !v.activo)

  const rowHandlers = {
    deleteLoading,
    onEdit: handleEdit,
    onToggleActive: handleToggleActive,
    onDelete: handleDelete,
    onShowHistory: setHistoryVariant,
  }

  // Skeleton solo en la primera carga: en los refrescos posteriores se mantiene
  // la lista montada para no cerrar los modales abiertos (p. ej. el de inactivas).
  if (loading && variants.length === 0) {
    return (
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-gray-400 dark:text-white/30" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70">Variantes</h3>
        </div>
        <p className="text-gray-400 dark:text-white/30 animate-pulse text-sm">Cargando variantes...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-gray-400 dark:text-white/30 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70">
            Variantes ({variants.length})
          </h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:shrink-0">
          <button
            onClick={() => setGeneratorOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-center leading-tight text-[#185749] dark:text-[#1CAAA8] bg-[#185749]/5 dark:bg-[#1CAAA8]/5 hover:bg-[#185749]/10 dark:hover:bg-[#1CAAA8]/10 rounded-lg transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            Generar combinaciones
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-center leading-tight text-[#185749] dark:text-[#1CAAA8] bg-[#185749]/5 dark:bg-[#1CAAA8]/5 hover:bg-[#185749]/10 dark:hover:bg-[#1CAAA8]/10 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            Agregar variante
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <p className="text-xs text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 cursor-pointer shrink-0">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 sm:p-6">
        {variants.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg">
            <Package className="w-10 h-10 text-gray-200 dark:text-white/10 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-white/40">Sin variantes</p>
            <p className="text-xs text-gray-400 dark:text-white/25 mt-1">Este producto se vende como producto simple</p>
          </div>
        ) : activeVariants.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg">
            <EyeOff className="w-10 h-10 text-gray-200 dark:text-white/10 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-white/40">No hay variantes activas</p>
            <p className="text-xs text-gray-400 dark:text-white/25 mt-1">Todas las variantes de este producto están desactivadas</p>
          </div>
        ) : (
          <>
            <VariantListHeader />
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {activeVariants.map((variant) => (
                <VariantRow key={variant.id} variant={variant} imageInfo={imageSummary.get(variant.id)} {...rowHandlers} />
              ))}
            </div>
          </>
        )}

        {/* Inactive variants — summary button, full list in a modal */}
        {inactiveVariants.length > 0 && (
          <button
            onClick={() => setInactiveOpen(true)}
            className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 dark:text-white/40 hover:text-[#185749] dark:hover:text-[#1CAAA8] bg-gray-50 dark:bg-white/[0.02] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 border border-gray-100 dark:border-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            Variantes inactivas ({inactiveVariants.length})
          </button>
        )}
      </div>

      {/* Inactive variants modal */}
      {inactiveOpen && inactiveVariants.length > 0 && (
        <Modal
          open
          onClose={() => setInactiveOpen(false)}
          title={`Variantes inactivas (${inactiveVariants.length})`}
          description="No se muestran en la tienda. Activalas para volver a venderlas."
          size="lg"
          className="max-w-3xl!"
        >
          <div className="-mx-2 sm:mx-0">
            <VariantListHeader />
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {inactiveVariants.map((variant) => (
                <VariantRow key={variant.id} variant={variant} imageInfo={imageSummary.get(variant.id)} {...rowHandlers} />
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Dialogs */}
      {dialogMode && (
        <VariantFormDialog
          productId={productId}
          mode={dialogMode}
          initialData={editingVariant || undefined}
          onConfirm={handleConfirm}
          onClose={() => { setDialogMode(null); setSaveError(null); void refreshImageSummary() }}
          loading={saving}
          error={saveError}
        />
      )}

      {generatorOpen && (
        <VariantCombinationGenerator
          productId={productId}
          existingVariants={variants}
          onClose={(created) => {
            setGeneratorOpen(false)
            if (created) setRefreshKey((k) => k + 1)
          }}
        />
      )}

      {historyVariant && (
        <PriceHistoryDialog
          variantId={historyVariant.id}
          variantName={`${historyVariant.nombre} (${historyVariant.sku})`}
          onClose={() => setHistoryVariant(null)}
        />
      )}

      {deletingVariant && (
        <Modal
          open
          onClose={() => setDeletingVariant(null)}
          title="Eliminar variante"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingVariant(null)}
                disabled={deleteLoading === deletingVariant.id}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading === deletingVariant.id}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleteLoading === deletingVariant.id && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleteLoading === deletingVariant.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 dark:text-white/60">
            ¿Estás seguro de que deseas eliminar la variante{' '}
            <strong className="text-gray-800 dark:text-white/80">{deletingVariant.nombre}</strong>?
          </p>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
            Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  )
}
