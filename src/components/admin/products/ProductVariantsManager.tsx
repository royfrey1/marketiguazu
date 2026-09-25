import { useState, useEffect } from 'react'
import { Plus, Loader2, Pencil, Trash2, ToggleLeft, ToggleRight, Package, History } from 'lucide-react'
import {
  productVariantsService,
  type VariantWithInventory,
  type VariantFormData,
} from '../../../services/productVariants.service'
import VariantFormDialog from './VariantFormDialog'
import PriceHistoryDialog from './PriceHistoryDialog'
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

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await productVariantsService.getByProductId(productId)
      if (!cancelled) {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setVariants(data || [])
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [productId, refreshKey])

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

  if (loading) {
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400 dark:text-white/30" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70">
            Variantes ({variants.length})
          </h3>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#185749] dark:text-[#1CAAA8] bg-[#185749]/5 dark:bg-[#1CAAA8]/5 hover:bg-[#185749]/10 dark:hover:bg-[#1CAAA8]/10 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar variante
        </button>
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
      <div className="p-6">
        {variants.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg">
            <Package className="w-10 h-10 text-gray-200 dark:text-white/10 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-white/40">Sin variantes</p>
            <p className="text-xs text-gray-400 dark:text-white/25 mt-1">Este producto se vende como producto simple</p>
          </div>
        ) : (
          <>
            {/* Desktop: table header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_80px_120px] gap-2 px-4 py-2 text-[11px] font-medium text-gray-400 dark:text-white/25 uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
              <span>Variante</span>
              <span>SKU</span>
              <span>Precio</span>
              <span className="text-center">Stock</span>
              <span className="text-right">Acciones</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {variants.map((variant) => {
                const inv = variant.inventory
                const available = (inv?.quantity ?? 0) - (inv?.reserved ?? 0)

                return (
                  <div
                    key={variant.id}
                    className={`px-4 py-4 sm:py-3 transition-colors ${
                      variant.activo
                        ? 'hover:bg-gray-50/50 dark:hover:bg-white/[0.02]'
                        : 'opacity-60'
                    }`}
                  >
                    {/* Desktop: table row */}
                    <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_80px_120px] gap-2 sm:items-center">
                      {/* Variante (nombre + imagen + atributos) */}
                      <div className="flex items-center gap-3 min-w-0">
                        {variant.imagen_url ? (
                          <img
                            src={variant.imagen_url}
                            alt={variant.nombre}
                            className="w-9 h-9 rounded-lg object-cover bg-gray-100 dark:bg-white/5 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/20 text-xs shrink-0">
                            --
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 dark:text-white/80 truncate">{variant.nombre}</span>
                            {!variant.activo && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-white/40 font-medium shrink-0">
                                INACTIVA
                              </span>
                            )}
                          </div>
                          {variant.atributos && typeof variant.atributos === 'object' && Object.keys(variant.atributos).length > 0 && (
                            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 truncate">
                              {Object.entries(variant.atributos).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* SKU */}
                      <span className="text-xs text-gray-500 dark:text-white/40 font-mono truncate">{variant.sku}</span>

                      {/* Precio */}
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white/80">${variant.precio.toLocaleString('es-AR')}</p>
                        {variant.precio_anterior && variant.precio_anterior > variant.precio && (
                          <p className="text-xs text-gray-400 dark:text-white/30 line-through">${variant.precio_anterior.toLocaleString('es-AR')}</p>
                        )}
                      </div>

                      {/* Stock */}
                      <div className="text-center">
                        <p className={`text-sm font-semibold ${available <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white/80'}`}>
                          {inv?.quantity ?? 0}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-white/25">
                          {inv?.reserved ?? 0} reserva{inv?.reserved !== 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => setHistoryVariant(variant)}
                          className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                          title="Historial de precios"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(variant)}
                          disabled={deleteLoading === variant.id}
                          className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                          title={variant.activo ? 'Desactivar' : 'Activar'}
                        >
                          {deleteLoading === variant.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : variant.activo ? (
                            <ToggleRight className="w-4 h-4 text-[#389C52]" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(variant)}
                          className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(variant)}
                          disabled={deleteLoading === variant.id}
                          className="p-1.5 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile: card */}
                    <div className="sm:hidden space-y-3">
                      <div className="flex items-start gap-3.5">
                        {variant.imagen_url ? (
                          <img
                            src={variant.imagen_url}
                            alt={variant.nombre}
                            className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-white/5 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/20 text-xs shrink-0">
                            --
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 dark:text-white/80 truncate">{variant.nombre}</span>
                            {!variant.activo && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-white/40 font-medium">
                                INACTIVA
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-white/30 font-mono mt-0.5">SKU: {variant.sku}</p>
                          {variant.atributos && typeof variant.atributos === 'object' && Object.keys(variant.atributos).length > 0 && (
                            <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                              {Object.entries(variant.atributos).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="variant-price-actions flex items-center justify-between pt-1">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white/80">${variant.precio.toLocaleString('es-AR')}</p>
                          {variant.precio_anterior && variant.precio_anterior > variant.precio && (
                            <p className="text-xs text-gray-400 dark:text-white/30 line-through">${variant.precio_anterior.toLocaleString('es-AR')}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setHistoryVariant(variant)}
                            className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                            title="Historial de precios"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(variant)}
                            disabled={deleteLoading === variant.id}
                            className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                            title={variant.activo ? 'Desactivar' : 'Activar'}
                          >
                            {deleteLoading === variant.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : variant.activo ? (
                              <ToggleRight className="w-4 h-4 text-[#389C52]" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(variant)}
                            className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(variant)}
                            disabled={deleteLoading === variant.id}
                            className="p-1.5 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {dialogMode && (
        <VariantFormDialog
          mode={dialogMode}
          initialData={editingVariant || undefined}
          onConfirm={handleConfirm}
          onClose={() => { setDialogMode(null); setSaveError(null) }}
          loading={saving}
          error={saveError}
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
