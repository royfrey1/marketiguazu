import { Link } from 'react-router-dom'
import { Pencil, Star, StarOff, Eye, EyeOff, Package, Loader2, MoreVertical, Trash2, RotateCcw } from 'lucide-react'
import { productsService, type ProductAdminRow } from '../../../services/products.service'
import { useState, useRef, useEffect } from 'react'

interface ProductTableProps {
  products: ProductAdminRow[]
  onToggleActive: (product: ProductAdminRow) => void
  onToggleDestacado: (product: ProductAdminRow) => void
  actionLoading: number | null
  onArchive: (product: ProductAdminRow) => void
  /** Modo papelera: solo Restaurar y Eliminar definitivamente (sin activar, destacar ni editar) */
  trash?: boolean
  onRestore?: (product: ProductAdminRow) => void
  onDeletePermanent?: (product: ProductAdminRow) => void
}

const TRASH_DATE = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Rótulo fijo en lugar del botón Activo/Inactivo: en la papelera el servidor rechaza esos cambios */
function TrashBadge({ product, small = false }: { product: ProductAdminRow; small?: boolean }) {
  return (
    <div>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ${small ? 'text-[10px]' : 'text-xs'}`}>
        <Trash2 className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} aria-hidden="true" />
        En papelera
      </span>
      {product.deleted_at && (
        <div className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5 whitespace-nowrap">
          desde el {TRASH_DATE.format(new Date(product.deleted_at))}
        </div>
      )}
    </div>
  )
}

/** Restaurar / Eliminar definitivamente, con texto visible (44px de alto fuera de la tabla de escritorio) */
function TrashActions({ product, onRestore, onDeletePermanent, isLoading, className = '' }: {
  product: ProductAdminRow
  onRestore?: (p: ProductAdminRow) => void
  onDeletePermanent?: (p: ProductAdminRow) => void
  isLoading: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onRestore?.(product)}
        disabled={isLoading}
        className="flex-1 xl:flex-none inline-flex items-center justify-center gap-1.5 min-h-11 xl:min-h-0 px-3 py-1.5 text-xs font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749]/30 dark:border-[#1CAAA8]/30 hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
      >
        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
        Restaurar
      </button>
      <button
        type="button"
        onClick={() => onDeletePermanent?.(product)}
        disabled={isLoading}
        className="flex-1 xl:flex-none inline-flex items-center justify-center gap-1.5 min-h-11 xl:min-h-0 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        Eliminar definitivamente
      </button>
    </div>
  )
}

/** Oferta efectiva: del producto ("Oferta -X%") o de sus variantes ("Oferta en N variantes") */
function OfferBadge({ product }: { product: ProductAdminRow }) {
  const offer = product.oferta
  if (!offer) return null
  const label = offer.variantes > 0
    ? `Oferta en ${offer.variantes} variante${offer.variantes !== 1 ? 's' : ''}`
    : `Oferta${offer.descuento !== null ? ` -${offer.descuento}%` : ''}`
  return (
    <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1CAAA8]/15 text-[#0D3732] dark:text-[#1CAAA8]">
      {label}
    </span>
  )
}

function StockBadge({ product }: { product: ProductAdminRow }) {
  const inv = product.inventory?.[0]
  const stock = inv?.quantity ?? 0
  const reserved = inv?.reserved ?? 0
  const available = stock - reserved
  const threshold = inv?.low_stock_threshold ?? 5

  const colors = available <= 0
    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    : available <= threshold
      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'

  return (
    <div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
        {available}
      </span>
      {reserved > 0 && (
        <div className="text-[10px] text-gray-400 dark:text-white/20 mt-0.5">
          {reserved} reservado{reserved !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

function ProductActions({ product, onToggleActive, onToggleDestacado, onArchive, isLoading }: {
  product: ProductAdminRow
  onToggleActive: (p: ProductAdminRow) => void
  onToggleDestacado: (p: ProductAdminRow) => void
  onArchive: (p: ProductAdminRow) => void
  isLoading: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center min-w-11 min-h-11 -m-2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
        aria-label="Acciones"
        aria-expanded={open}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A2B27] z-50 overflow-hidden py-1">
          <button
            onClick={() => { onToggleDestacado(product); setOpen(false) }}
            disabled={isLoading}
            className="flex items-center gap-2.5 w-full min-h-11 px-3 py-2 text-sm text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
          >
            {product.destacado
              ? <StarOff className="w-4 h-4 text-amber-500" />
              : <Star className="w-4 h-4 text-gray-400" />
            }
            {product.destacado ? 'Quitar destacado' : 'Destacar'}
          </button>
          <button
            onClick={() => { onToggleActive(product); setOpen(false) }}
            disabled={isLoading}
            className="flex items-center gap-2.5 w-full min-h-11 px-3 py-2 text-sm text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
          >
            {product.activo
              ? <EyeOff className="w-4 h-4 text-gray-400" />
              : <Eye className="w-4 h-4 text-emerald-500" />
            }
            {product.activo ? 'Desactivar' : 'Activar'}
          </button>
          <div className="border-t border-gray-100 dark:border-white/5 my-1" />
          <Link
            to={`/admin/productos/${product.id}/editar`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full min-h-11 px-3 py-2 text-sm text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Pencil className="w-4 h-4 text-gray-400" />
            Editar
          </Link>
          <div className="border-t border-gray-100 dark:border-white/5 my-1" />
          <button
            onClick={() => { onArchive(product); setOpen(false) }}
            disabled={isLoading}
            className="flex items-center gap-2.5 w-full min-h-11 px-3 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer text-left"
          >
            <Trash2 className="w-4 h-4" />
            Enviar a papelera
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProductTable({
  products,
  onToggleActive,
  onToggleDestacado,
  actionLoading,
  onArchive,
  trash = false,
  onRestore,
  onDeletePermanent,
}: ProductTableProps) {
  if (products.length === 0 && trash) {
    return (
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
        <Trash2 className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-white/40 font-medium">La papelera está vacía</p>
        <p className="text-sm text-gray-400 dark:text-white/25 mt-1">Los productos que envíes a la papelera aparecen acá</p>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
        <Package className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-white/40 font-medium">No se encontraron productos</p>
        <p className="text-sm text-gray-400 dark:text-white/25 mt-1">Creá un producto o ajustá los filtros</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      {/* Papelera: la tabla (con Restaurar y Eliminar definitivamente) necesita más ancho; debajo de xl, tarjetas */}
      <div className={`hidden ${trash ? 'xl:block' : 'lg:block'} bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5">
              <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30 w-18"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-gray-400 dark:text-white/30">Precio</th>
              <th className="text-center px-4 py-3 font-medium text-gray-400 dark:text-white/30">Stock</th>
              <th className="text-center px-4 py-3 font-medium text-gray-400 dark:text-white/30">Estado</th>
              <th className={`text-right px-4 py-3 font-medium text-gray-400 dark:text-white/30 ${trash ? '' : 'w-20'}`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {products.map((product) => {
              const imageUrl = productsService.resolveImageUrl(product)
              const isLoading = actionLoading === product.id

              return (
                <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-white/5">
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-white/20 text-lg">
                          {product.categories?.icono || '📦'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* Papelera: nombre completo (hasta 2 líneas) e ID, para no confundir qué se borra */}
                    <div className={`font-medium text-gray-800 dark:text-white/80 ${trash ? 'line-clamp-2 break-words' : 'line-clamp-1'}`}>{product.titulo}</div>
                    {trash && <div className="text-xs text-gray-400 dark:text-white/25 mt-0.5">ID {product.id}</div>}
                    {product.marca && (
                      <div className="text-xs text-gray-400 dark:text-white/25 mt-0.5">{product.marca}</div>
                    )}
                    <OfferBadge product={product} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600 dark:text-white/50">
                      {product.categories?.icono} {product.categories?.nombre || 'Sin categoría'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold text-gray-800 dark:text-white/80">
                      ${product.precio.toLocaleString('es-AR')}
                    </div>
                    {product.precio_anterior && product.precio_anterior > product.precio && (
                      <div className="text-xs text-gray-400 dark:text-white/20 line-through">
                        ${product.precio_anterior.toLocaleString('es-AR')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StockBadge product={product} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {trash ? <TrashBadge product={product} /> : (
                    <button
                      onClick={() => onToggleActive(product)}
                      disabled={isLoading}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                        isLoading ? 'opacity-50 cursor-wait' : ''
                      } ${
                        product.activo
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/30 hover:bg-gray-200 dark:hover:bg-white/10'
                      }`}
                      title={product.activo ? 'Desactivar' : 'Activar'}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : product.activo ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3" />
                      )}
                      {product.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {trash ? (
                      <TrashActions
                        product={product}
                        onRestore={onRestore}
                        onDeletePermanent={onDeletePermanent}
                        isLoading={isLoading}
                        className="flex-col items-stretch"
                      />
                    ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onToggleDestacado(product)}
                        disabled={isLoading}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isLoading ? 'opacity-50 cursor-wait' : ''
                        } ${
                          product.destacado
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-gray-300 dark:text-white/15 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-500 dark:hover:text-white/40'
                        }`}
                        title={product.destacado ? 'Quitar destacado' : 'Destacar'}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : product.destacado ? (
                          <Star className="w-4 h-4 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                      </button>
                      <Link
                        to={`/admin/productos/${product.id}/editar`}
                        className="p-1.5 text-gray-400 dark:text-white/25 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onArchive(product)}
                        disabled={isLoading}
                        className="p-1.5 text-gray-400 dark:text-white/25 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Enviar a papelera"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        <span className="sr-only">Enviar a papelera: {product.titulo}</span>
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className={`${trash ? 'xl:hidden' : 'lg:hidden'} space-y-3`}>
        {products.map((product) => {
          const imageUrl = productsService.resolveImageUrl(product)
          const isLoading = actionLoading === product.id

          return (
            <div key={product.id} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
              {/* Header: image + title + status */}
              <div className="flex items-start gap-3">
                {imageUrl ? (
                  <img src={imageUrl} alt={product.titulo} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/20 text-xl flex-shrink-0">
                    {product.categories?.icono || '📦'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className={`font-medium text-gray-800 dark:text-white/80 text-sm ${trash ? 'line-clamp-2 break-words' : 'line-clamp-1'}`}>{product.titulo}</h3>
                      {trash && <p className="text-xs text-gray-400 dark:text-white/25 mt-0.5">ID {product.id}</p>}
                      {product.marca && (
                        <p className="text-xs text-gray-400 dark:text-white/25 mt-0.5">{product.marca}</p>
                      )}
                      <OfferBadge product={product} />
                    </div>
                    {trash ? <div className="flex-shrink-0 text-right"><TrashBadge product={product} small /></div> : (
                    <button
                      onClick={() => onToggleActive(product)}
                      disabled={isLoading}
                      className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-all ${
                        isLoading ? 'opacity-50 cursor-wait' : ''
                      } ${
                        product.activo
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/30'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : product.activo ? (
                        <Eye className="w-2.5 h-2.5" />
                      ) : (
                        <EyeOff className="w-2.5 h-2.5" />
                      )}
                      {product.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Info row */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-400 dark:text-white/25">
                    {product.categories?.icono} {product.categories?.nombre || 'Sin categoría'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/80">
                    ${product.precio.toLocaleString('es-AR')}
                  </span>
                  {product.precio_anterior && product.precio_anterior > product.precio && (
                    <span className="text-xs text-gray-400 dark:text-white/20 line-through ml-1.5">
                      ${product.precio_anterior.toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
                <StockBadge product={product} />
                {!trash && (
                  <ProductActions
                    product={product}
                    onToggleActive={onToggleActive}
                    onToggleDestacado={onToggleDestacado}
                    onArchive={onArchive}
                    isLoading={isLoading}
                  />
                )}
              </div>
              {trash && (
                <TrashActions
                  product={product}
                  onRestore={onRestore}
                  onDeletePermanent={onDeletePermanent}
                  isLoading={isLoading}
                  className="mt-3"
                />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
