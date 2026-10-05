import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import type { VariantFormData } from '../../../services/productVariants.service'
import Modal from '../../ui/Modal'
import { sanitizeAttributeName } from '../../../lib/variantAttributes'
import VariantImagesManager from './VariantImagesManager'

interface VariantFormDialogProps {
  productId: number
  mode: 'create' | 'edit'
  initialData?: VariantFormData & { id?: number }
  onConfirm: (data: VariantFormData) => Promise<void>
  onClose: () => void
  loading: boolean
  error?: string | null
}

const EMPTY_FORM: VariantFormData = {
  sku: '',
  nombre: '',
  precio: 0,
  precio_anterior: null,
  atributos: null,
  imagen_url: null,
  activo: true,
}

export default function VariantFormDialog({ productId, mode, initialData, onConfirm, onClose, loading, error }: VariantFormDialogProps) {
  const [form, setForm] = useState<VariantFormData>(() => {
    if (initialData) {
      return {
        sku: initialData.sku || '',
        nombre: initialData.nombre || '',
        precio: initialData.precio || 0,
        precio_anterior: initialData.precio_anterior ?? null,
        atributos: initialData.atributos || null,
        imagen_url: initialData.imagen_url || null,
        activo: initialData.activo ?? true,
      }
    }
    return EMPTY_FORM
  })
  const [attributePairs, setAttributePairs] = useState<{ key: string; value: string }[]>(() => {
    if (initialData?.atributos && typeof initialData.atributos === 'object') {
      const pairs = Object.entries(initialData.atributos).map(([key, value]) => ({ key, value: String(value) }))
      return pairs.length > 0 ? pairs : [{ key: '', value: '' }]
    }
    return [{ key: '', value: '' }]
  })

  const handleAddAttribute = () => {
    setAttributePairs([...attributePairs, { key: '', value: '' }])
  }

  const handleRemoveAttribute = (index: number) => {
    setAttributePairs(attributePairs.filter((_, i) => i !== index))
  }

  const handleAttributeChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...attributePairs]
    updated[index][field] = val
    setAttributePairs(updated)
  }

  const buildAtributos = (): Record<string, string> | null => {
    const valid = attributePairs.filter((p) => sanitizeAttributeName(p.key) && p.value.trim())
    if (valid.length === 0) return null
    const obj: Record<string, string> = {}
    for (const p of valid) {
      obj[sanitizeAttributeName(p.key)] = p.value.trim()
    }
    return obj
  }

  const handleSubmit = async () => {
    await onConfirm({
      ...form,
      atributos: buildAtributos(),
    })
  }

  const inputClasses = "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? 'Nueva variante' : 'Editar variante'}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.sku.trim() || !form.nombre.trim() || form.precio < 0 || loading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              form.sku.trim() && form.nombre.trim() && form.precio >= 0
                ? 'bg-[#185749] text-white hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/20 cursor-not-allowed'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'create' ? 'Crear variante' : 'Guardar cambios'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">SKU *</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            placeholder="Ej: VID-NEGRO-M"
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Nombre *</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Negro, Talle M"
            className={inputClasses}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Precio *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: parseFloat(e.target.value) || 0 })}
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Precio anterior</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.precio_anterior ?? ''}
            onChange={(e) => setForm({ ...form, precio_anterior: e.target.value ? parseFloat(e.target.value) : null })}
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">URL de imagen</label>
        <input
          type="text"
          value={form.imagen_url ?? ''}
          onChange={(e) => setForm({ ...form, imagen_url: e.target.value || null })}
          placeholder="https://..."
          className={inputClasses}
        />
      </div>

      {/* Atributos */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-white/70">Atributos</label>
          <button
            type="button"
            onClick={handleAddAttribute}
            className="flex items-center gap-1 text-xs text-[#185749] dark:text-[#1CAAA8] hover:text-[#0D3732] dark:hover:text-[#1CAAA8]/80 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Agregar
          </button>
        </div>
        <div className="space-y-2">
          {attributePairs.map((pair, index) => {
            const savedKey = sanitizeAttributeName(pair.key)
            // El aviso solo aparece si la sanitización cambió algo además de los espacios
            const keyWasCleaned = pair.key.trim() !== '' && savedKey !== pair.key.trim()
            return (
              <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={pair.key}
                      onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                      placeholder="Clave (ej: color)"
                      className="w-full min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20"
                    />
                    {keyWasCleaned && (
                      <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                        Se guardará como:{' '}
                        {savedKey
                          ? <span className="font-mono font-medium">{savedKey}</span>
                          : <span className="italic">(vacío)</span>}
                      </p>
                    )}
                  </div>
                  <input
                    type="text"
                    value={pair.value}
                    onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                    placeholder="Valor (ej: Negro)"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20"
                  />
                </div>
                {attributePairs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(index)}
                    className="p-1 sm:mt-1 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 cursor-pointer self-center sm:self-start"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Fotos de la variante (solo con la variante ya creada: necesita su id) */}
      {mode === 'edit' && initialData?.id ? (
        <div className="pt-1">
          <VariantImagesManager productId={productId} variantId={initialData.id} />
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-white/30">
          Podés agregar fotos después de crear la variante.
        </p>
      )}

      {/* Activo */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="variant-activo"
          checked={form.activo}
          onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          className="rounded border-gray-300 dark:border-white/20"
        />
        <label htmlFor="variant-activo" className="text-sm text-gray-700 dark:text-white/70">Variante activa</label>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-3">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </Modal>
  )
}
