import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../../ui/Modal'
import { productsService, type ProductAdminRow } from '../../../services/products.service'
import { productVariantsService, type VariantWithInventory } from '../../../services/productVariants.service'
import { offersService } from '../../../services/offers.service'
import { offerPriceError, formatArs } from '../../../lib/offers'
import OfferPricePreview from './OfferPricePreview'

interface AddOfferDialogProps {
  onClose: () => void
  onSaved: () => void
}

const inputClasses = 'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors'

const parsePrice = (value: string): number | null => {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Agregar a ofertas: buscar producto activo, elegir variante si tiene, cargar precios y guardar */
export default function AddOfferDialog({ onClose, onSaved }: AddOfferDialogProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ProductAdminRow[]>([])
  const [searching, setSearching] = useState(false)
  const [product, setProduct] = useState<ProductAdminRow | null>(null)
  const [variants, setVariants] = useState<VariantWithInventory[] | null>(null)
  const [variant, setVariant] = useState<VariantWithInventory | null>(null)
  const [precio, setPrecio] = useState('')
  const [precioAnterior, setPrecioAnterior] = useState('')
  const [saving, setSaving] = useState(false)

  // Búsqueda del admin (solo productos activos), con una pequeña espera mientras se escribe
  useEffect(() => {
    if (product) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      const { data } = await productsService.getAllAdmin(1, 8, { search: search.trim() || undefined, activo: true })
      if (!cancelled) {
        setResults(data)
        setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search, product])

  const loadPrices = (source: { precio: number; precio_anterior: number | null }) => {
    setPrecio(String(source.precio))
    setPrecioAnterior(source.precio_anterior !== null ? String(source.precio_anterior) : '')
  }

  const selectProduct = async (row: ProductAdminRow) => {
    setProduct(row)
    setVariant(null)
    setVariants(null)
    const { data } = await productVariantsService.getActiveByProductId(row.id)
    const active = data ?? []
    setVariants(active)
    // Sin variantes activas la oferta es del producto; con variantes, primero se elige cuál
    if (active.length === 0) loadPrices(row)
  }

  const selectVariant = (v: VariantWithInventory) => {
    setVariant(v)
    loadPrices(v)
  }

  const resetProduct = () => {
    setProduct(null)
    setVariants(null)
    setVariant(null)
    setPrecio('')
    setPrecioAnterior('')
  }

  const needsVariant = !!variants && variants.length > 0
  const ready = !!product && variants !== null && (!needsVariant || !!variant)
  const precioNum = parsePrice(precio)
  const precioAnteriorNum = parsePrice(precioAnterior)
  const error = ready ? offerPriceError(precioNum, precioAnteriorNum) : null

  const handleSave = async () => {
    if (!product || !ready || error || precioNum === null || precioAnteriorNum === null) return
    setSaving(true)
    const prices = { precio: precioNum, precio_anterior: precioAnteriorNum }
    const { error: saveError } = variant
      ? await offersService.setVariantOffer(variant.id, true, prices)
      : await offersService.setProductOffer(product.id, true, prices)
    setSaving(false)
    if (saveError) {
      // Mensaje de la base tal cual (por ejemplo el tope de 90% o la regla de variantes)
      sileo.error({ title: 'No se pudo agregar la oferta', description: saveError.message })
      return
    }
    sileo.success({ title: 'Oferta agregada', description: variant ? `${product.titulo} · ${variant.nombre}` : product.titulo })
    onSaved()
  }

  return (
    <Modal
      open
      onClose={() => { if (!saving) onClose() }}
      title="Agregar a ofertas"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!ready || !!error || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer bg-[#185749] text-white hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      }
    >
      {!product ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto activo..."
              aria-label="Buscar producto"
              className={`${inputClasses} pl-9`}
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 rounded-lg border border-gray-200 dark:border-white/10">
            {searching && results.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 dark:text-white/30 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
              </p>
            ) : results.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 dark:text-white/30">No se encontraron productos activos.</p>
            ) : (
              results.map(row => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void selectProduct(row)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800 dark:text-white/80 truncate">{row.titulo}</span>
                    {row.oferta && <span className="text-[11px] text-[#185749] dark:text-[#1CAAA8]">Ya tiene oferta</span>}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-white/40 shrink-0">{formatArs(row.precio)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2.5">
            <span className="text-sm font-medium text-gray-800 dark:text-white/80 truncate">{product.titulo}</span>
            <button
              type="button"
              onClick={resetProduct}
              disabled={saving}
              className="text-xs font-medium text-[#185749] dark:text-[#1CAAA8] hover:underline cursor-pointer shrink-0"
            >
              Cambiar
            </button>
          </div>

          {variants === null && (
            <p className="text-sm text-gray-400 dark:text-white/30 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando variantes...
            </p>
          )}

          {needsVariant && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                Este producto tiene variantes: elegí la variante en oferta
              </legend>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {variants!.map(v => (
                  <label
                    key={v.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                      variant?.id === v.id
                        ? 'border-[#185749] dark:border-[#1CAAA8] bg-[#185749]/5 dark:bg-[#1CAAA8]/10'
                        : 'border-gray-200 dark:border-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="radio"
                        name="offer-variant"
                        checked={variant?.id === v.id}
                        onChange={() => selectVariant(v)}
                      />
                      <span className="truncate text-gray-800 dark:text-white/80">{v.nombre}</span>
                      {v.en_oferta && <span className="text-[11px] text-[#185749] dark:text-[#1CAAA8] shrink-0">Ya en oferta</span>}
                    </span>
                    <span className="text-gray-500 dark:text-white/40 shrink-0">{formatArs(v.precio)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {ready && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="offer-precio-anterior" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                    Precio anterior <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="offer-precio-anterior"
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioAnterior}
                    onChange={e => setPrecioAnterior(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="offer-precio" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                    Precio de oferta (precio actual) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="offer-precio"
                    type="number"
                    min="0"
                    step="0.01"
                    value={precio}
                    onChange={e => setPrecio(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-white/40">
                El precio anterior es el precio normal vigente antes de la oferta y tiene que ser un precio real de venta.
              </p>
              <OfferPricePreview precio={precioNum} precioAnterior={precioAnteriorNum} />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
