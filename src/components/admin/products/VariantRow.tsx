import { Loader2, Pencil, Trash2, ToggleLeft, ToggleRight, History } from 'lucide-react'
import type { VariantWithInventory } from '../../../services/productVariants.service'
import type { VariantImageSummary } from '../../../services/productImages.service'

const GRID_COLS = 'sm:grid-cols-[1fr_100px_100px_80px_120px]'

/** Encabezado de columnas (solo desktop) para una lista de VariantRow. */
export function VariantListHeader() {
  return (
    <div className={`hidden sm:grid ${GRID_COLS} gap-2 px-4 py-2 text-[11px] font-medium text-gray-400 dark:text-white/25 uppercase tracking-wider border-b border-gray-100 dark:border-white/5`}>
      <span>Variante</span>
      <span>SKU</span>
      <span>Precio</span>
      <span className="text-center">Stock</span>
      <span className="text-right">Acciones</span>
    </div>
  )
}

/**
 * Miniatura de la variante: foto principal de su galería, o si no tiene, su
 * imagen_url legacy, o "--". El badge con la cantidad de fotos va superpuesto
 * (absolute) para no agregar ancho a la grilla.
 */
function VariantThumb({ variant, imageInfo, sizeClass }: {
  variant: VariantWithInventory
  imageInfo?: VariantImageSummary
  sizeClass: string
}) {
  const url = imageInfo?.principalUrl ?? variant.imagen_url ?? null
  const count = imageInfo?.count ?? 0
  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      {url ? (
        <img
          src={url}
          alt={variant.nombre}
          className="w-full h-full rounded-lg object-cover bg-gray-100 dark:bg-white/5"
        />
      ) : (
        <div className="w-full h-full rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/20 text-xs">
          --
        </div>
      )}
      {count > 0 && (
        <span
          title={`${count} ${count === 1 ? 'foto' : 'fotos'}`}
          className="absolute -bottom-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#185749] dark:bg-[#1CAAA8] text-white text-[9px] font-bold leading-4 text-center ring-2 ring-white dark:ring-[#162420]"
        >
          {count}
        </span>
      )}
    </div>
  )
}

interface VariantRowProps {
  variant: VariantWithInventory
  /** Resumen de la galería propia de la variante (si tiene). */
  imageInfo?: VariantImageSummary
  deleteLoading: number | null
  onEdit: (variant: VariantWithInventory) => void
  onToggleActive: (variant: VariantWithInventory) => void
  onDelete: (variant: VariantWithInventory) => void
  onShowHistory: (variant: VariantWithInventory) => void
}

/** Fila de variante: fila de tabla en desktop, tarjeta en mobile. */
export default function VariantRow({ variant, imageInfo, deleteLoading, onEdit, onToggleActive, onDelete, onShowHistory }: VariantRowProps) {
  const inv = variant.inventory
  const available = (inv?.quantity ?? 0) - (inv?.reserved ?? 0)

  return (
    <div
      className={`px-4 py-4 sm:py-3 transition-colors ${
        variant.activo
          ? 'hover:bg-gray-50/50 dark:hover:bg-white/[0.02]'
          : 'opacity-60'
      }`}
    >
      {/* Desktop: table row */}
      <div className={`hidden sm:grid ${GRID_COLS} gap-2 sm:items-center`}>
        {/* Variante (nombre + imagen + atributos) */}
        <div className="flex items-center gap-3 min-w-0">
          <VariantThumb variant={variant} imageInfo={imageInfo} sizeClass="w-9 h-9" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-gray-800 dark:text-white/80 truncate min-w-0">{variant.nombre}</span>
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
            onClick={() => onShowHistory(variant)}
            className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
            title="Historial de precios"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleActive(variant)}
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
            onClick={() => onEdit(variant)}
            className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(variant)}
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
          <VariantThumb variant={variant} imageInfo={imageInfo} sizeClass="w-10 h-10" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-gray-800 dark:text-white/80 truncate flex-1 min-w-0">{variant.nombre}</span>
              {!variant.activo && (
                <span className="text-[9px] leading-none px-1 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-white/40 font-medium tracking-wide shrink-0">
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
              onClick={() => onShowHistory(variant)}
              className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
              title="Historial de precios"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleActive(variant)}
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
              onClick={() => onEdit(variant)}
              className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors cursor-pointer"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(variant)}
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
}
