import { Minus, Plus, Trash2 } from 'lucide-react'
import type { CartItemWithProduct } from '../../types/cart'
import { cartItemImage, cartItemOptionLabel } from '../../lib/cartItemDisplay'
import useCart from '../../hooks/useCart'
import useRemoveCartItem from '../../hooks/useRemoveCartItem'

interface CartItemCardProps {
  item: CartItemWithProduct
}

export default function CartItemCard({ item }: CartItemCardProps) {
  const { updateQuantity, loading } = useCart()
  const requestRemove = useRemoveCartItem()
  const product = item.products

  // Foto de la variante si tiene; si no (y para la opción base), la del producto
  const { url: resolvedImageUrl, alt: altText } = cartItemImage(item)

  const subtotal = item.precio_unitario * item.cantidad

  // Solo invitado (las líneas logueadas no traen estos campos): tope de stock y aviso de precio cambiado
  const atMax = item.available !== undefined && item.cantidad >= item.available
  const priceChanged = item.stored_precio_unitario !== undefined && item.stored_precio_unitario !== item.precio_unitario
  const priceNotice = priceChanged ? (
    <p className="text-xs text-amber-700 mt-0.5">
      El precio cambió (antes ${item.stored_precio_unitario!.toLocaleString('es-AR')})
    </p>
  ) : null

  // "-" con cantidad 1 quita la línea: pasa por el mismo flujo que la papelera (confirmación + Deshacer)
  const handleDecrease = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (item.cantidad <= 1) requestRemove(item, e.currentTarget)
    else updateQuantity(item.id, item.cantidad - 1)
  }

  // "Color: Dreamscape" / "Color: Gris acero" (opción base; solo el nombre si el atributo no es claro)
  const optionLabel = cartItemOptionLabel(item)
  const itemName = `${product?.titulo ?? 'producto'}${optionLabel ? ` - ${optionLabel}` : ''}`

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
      {/* Mobile layout */}
      <div className="sm:hidden p-4 space-y-3">
        {/* Row 1: Image + Info */}
        <div className="flex gap-3">
          <div className="w-16 h-16 shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
            {resolvedImageUrl ? (
              <img src={resolvedImageUrl} alt={altText} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-gray-300">📦</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-primary-dark truncate">
              {product?.titulo ?? 'Producto'}
            </h3>
            {optionLabel && (
              <p className="text-xs text-gray-500 mt-0.5">{optionLabel}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              ${item.precio_unitario.toLocaleString('es-AR')} c/u
            </p>
            {priceNotice}
          </div>
        </div>

        {/* Row 2: Quantity + Subtotal + Delete */}
        <div className="flex items-center justify-between gap-3 ml-[1.75rem]">
          <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={handleDecrease}
              disabled={loading}
              aria-label="Disminuir cantidad"
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span
              className="min-w-[1.5rem] w-12 text-center text-xs font-bold text-primary-dark border-x border-gray-200"
              aria-label={`Cantidad: ${item.cantidad}`}
            >
              {item.cantidad}
            </span>
            <button
              onClick={() => updateQuantity(item.id, item.cantidad + 1)}
              disabled={loading || atMax}
              aria-label="Aumentar cantidad"
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <span className="text-sm font-bold text-accent whitespace-nowrap">
            ${subtotal.toLocaleString('es-AR')}
          </span>

          <button
            onClick={e => requestRemove(item, e.currentTarget)}
            disabled={loading}
            aria-label={`Eliminar ${itemName}`}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:flex gap-4 p-4">
        <div className="w-24 h-24 shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
          {resolvedImageUrl ? (
            <img src={resolvedImageUrl} alt={altText} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl text-gray-300">📦</span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-primary-dark truncate">
              {product?.titulo ?? 'Producto'}
            </h3>
            {optionLabel && (
              <p className="text-xs text-gray-500 mt-0.5">{optionLabel}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              ${item.precio_unitario.toLocaleString('es-AR')} c/u
            </p>
            {priceNotice}
          </div>

          <div className="flex items-center justify-between mt-3 gap-2">
            <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={handleDecrease}
                disabled={loading}
                aria-label="Disminuir cantidad"
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span
                className="w-10 text-center text-sm font-bold text-primary-dark border-x border-gray-200"
                aria-label={`Cantidad: ${item.cantidad}`}
              >
                {item.cantidad}
              </span>
              <button
                onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                disabled={loading || atMax}
                aria-label="Aumentar cantidad"
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-accent">
                ${subtotal.toLocaleString('es-AR')}
              </span>
              <button
                onClick={e => requestRemove(item, e.currentTarget)}
                disabled={loading}
                aria-label={`Eliminar ${itemName}`}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
