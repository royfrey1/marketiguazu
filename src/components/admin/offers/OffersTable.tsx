import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Package, Pencil, XCircle } from 'lucide-react'
import type { AdminOffer, AdminOfferVariant } from '../../../services/offers.service'
import { formatArs } from '../../../lib/offers'

export type RemoveTarget = { offer: AdminOffer; variant?: AdminOfferVariant }

interface OffersTableProps {
  offers: AdminOffer[]
  onRemove: (target: RemoveTarget) => void
}

const iconButton = 'p-1.5 rounded-lg transition-colors cursor-pointer text-gray-400 dark:text-white/30'

function Thumb({ offer, size }: { offer: AdminOffer; size: string }) {
  return (
    <div className={`${size} rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-white/5`}>
      {offer.imageUrl ? (
        <img src={offer.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-white/20">
          <Package className="w-4 h-4" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

function TypeBadge({ offer }: { offer: AdminOffer }) {
  const label = offer.tipo === 'variantes'
    ? `${offer.variantes.length} variante${offer.variantes.length !== 1 ? 's' : ''}`
    : 'Producto'
  return (
    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/50">
      {label}
    </span>
  )
}

function StatusBadge({ activo }: { activo: boolean }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
      activo
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
        : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/30'
    }`}>
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function Discount({ value }: { value: number }) {
  return <span className="font-bold text-[#185749] dark:text-[#1CAAA8]">-{value}%</span>
}

function EditLink({ offer }: { offer: AdminOffer }) {
  return (
    <Link
      to={`/admin/productos/${offer.productId}/editar`}
      className={`${iconButton} hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5`}
      title="Editar producto"
      aria-label={`Editar ${offer.titulo}`}
    >
      <Pencil className="w-4 h-4" />
    </Link>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${iconButton} hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
      title="Quitar de ofertas"
      aria-label={`Quitar de ofertas: ${label}`}
    >
      <XCircle className="w-4 h-4" />
    </button>
  )
}

/** Ofertas activas: tabla en desktop y tarjetas en mobile. Las variantes en oferta se despliegan por producto */
export default function OffersTable({ offers, onRemove }: OffersTableProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5">
              <th className="text-left px-4 py-3 font-medium text-gray-400 dark:text-white/30">Producto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-400 dark:text-white/30">Precio normal</th>
              <th className="text-right px-4 py-3 font-medium text-gray-400 dark:text-white/30">Precio de oferta</th>
              <th className="text-center px-4 py-3 font-medium text-gray-400 dark:text-white/30">Descuento</th>
              <th className="text-center px-4 py-3 font-medium text-gray-400 dark:text-white/30">Stock</th>
              <th className="text-center px-4 py-3 font-medium text-gray-400 dark:text-white/30">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-400 dark:text-white/30 w-28">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {offers.map(offer => {
              const isOpen = expanded.has(offer.productId)
              return [
                <tr key={offer.productId} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Thumb offer={offer} size="w-10 h-10" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 dark:text-white/80 line-clamp-1">{offer.titulo}</div>
                        <div className="mt-0.5"><TypeBadge offer={offer} /></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 dark:text-white/30 line-through">{formatArs(offer.precioAnterior)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-white/80">
                    {offer.tipo === 'variantes' && <span className="font-normal text-xs text-gray-400 dark:text-white/30">desde </span>}
                    {formatArs(offer.precio)}
                  </td>
                  <td className="px-4 py-3 text-center"><Discount value={offer.descuento} /></td>
                  <td className="px-4 py-3 text-center text-gray-700 dark:text-white/60">{offer.disponible}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge activo={offer.activo} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {offer.tipo === 'variantes' ? (
                        <button
                          type="button"
                          onClick={() => toggle(offer.productId)}
                          aria-expanded={isOpen}
                          className={`${iconButton} hover:text-[#185749] dark:hover:text-[#1CAAA8]`}
                          title={isOpen ? 'Ocultar variantes' : 'Ver variantes'}
                          aria-label={`${isOpen ? 'Ocultar' : 'Ver'} variantes en oferta de ${offer.titulo}`}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      ) : (
                        <RemoveButton label={offer.titulo} onClick={() => onRemove({ offer })} />
                      )}
                      <EditLink offer={offer} />
                    </div>
                  </td>
                </tr>,
                ...(isOpen ? offer.variantes.map(v => (
                  <tr key={`${offer.productId}-${v.id}`} className="bg-gray-50/60 dark:bg-white/[0.015]">
                    <td className="px-4 py-2 pl-[4.25rem]">
                      <div className="text-gray-700 dark:text-white/70">{v.nombre}</div>
                      <div className="text-[11px] font-mono text-gray-400 dark:text-white/30">{v.sku}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-400 dark:text-white/30 line-through">{formatArs(v.precioAnterior)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-white/80">{formatArs(v.precio)}</td>
                    <td className="px-4 py-2 text-center"><Discount value={v.descuento} /></td>
                    <td className="px-4 py-2 text-center text-gray-700 dark:text-white/60">{v.disponible}</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end">
                        <RemoveButton label={`${offer.titulo} · ${v.nombre}`} onClick={() => onRemove({ offer, variant: v })} />
                      </div>
                    </td>
                  </tr>
                )) : []),
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="lg:hidden space-y-3">
        {offers.map(offer => (
          <div key={offer.productId} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
            <div className="flex items-start gap-3">
              <Thumb offer={offer} size="w-12 h-12" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-800 dark:text-white/80 text-sm line-clamp-2 min-w-0">{offer.titulo}</h3>
                  <StatusBadge activo={offer.activo} />
                </div>
                <div className="mt-1"><TypeBadge offer={offer} /></div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-white/5 text-sm">
              <span className="text-gray-400 dark:text-white/30 line-through">{formatArs(offer.precioAnterior)}</span>
              <span className="font-semibold text-gray-800 dark:text-white/80">
                {offer.tipo === 'variantes' && <span className="font-normal text-xs text-gray-400 dark:text-white/30">desde </span>}
                {formatArs(offer.precio)}
              </span>
              <Discount value={offer.descuento} />
              <span className="text-xs text-gray-500 dark:text-white/40">Stock: {offer.disponible}</span>
              <div className="ml-auto flex items-center gap-0.5">
                {offer.tipo === 'producto' && <RemoveButton label={offer.titulo} onClick={() => onRemove({ offer })} />}
                <EditLink offer={offer} />
              </div>
            </div>

            {offer.tipo === 'variantes' && (
              <ul className="mt-3 space-y-2">
                {offer.variantes.map(v => (
                  <li key={v.id} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-700 dark:text-white/70 truncate">{v.nombre}</div>
                      <div className="flex flex-wrap gap-x-2 mt-0.5">
                        <span className="text-gray-400 dark:text-white/30 line-through">{formatArs(v.precioAnterior)}</span>
                        <span className="font-semibold text-gray-800 dark:text-white/80">{formatArs(v.precio)}</span>
                        <Discount value={v.descuento} />
                        <span className="text-gray-500 dark:text-white/40">Stock: {v.disponible}</span>
                      </div>
                    </div>
                    <RemoveButton label={`${offer.titulo} · ${v.nombre}`} onClick={() => onRemove({ offer, variant: v })} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
