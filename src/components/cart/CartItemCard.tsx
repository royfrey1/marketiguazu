import { Minus, Plus, Trash2 } from 'lucide-react'
import { productImagesService } from '../../services/productImages.service'
import { productsService } from '../../services/products.service'
import type { CartItemWithProduct } from '../../types/cart'
import useCart from '../../hooks/useCart'

interface CartItemCardProps {
  item: CartItemWithProduct
}

export default function CartItemCard({ item }: CartItemCardProps) {
  const { updateQuantity, removeItem, loading } = useCart()
  const product = item.products
  const variant = item.product_variants

  const resolvedImageUrl = product
    ? productsService.resolveImageUrl(product)
    : null

  const altText = product
    ? productImagesService.resolveAltText(
        product.product_images?.[0] ?? null,
        product.titulo
      )
    : 'Producto'

  const subtotal = item.precio_unitario * item.cantidad

  const variantAttrs = variant?.atributos &&
    typeof variant.atributos === 'object' &&
    !Array.isArray(variant.atributos)
      ? Object.entries(variant.atributos as Record<string, string>)
      : []

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
            {variant && variantAttrs.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {variantAttrs.map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              ${item.precio_unitario.toLocaleString('es-AR')} c/u
            </p>
          </div>
        </div>

        {/* Row 2: Quantity + Subtotal + Delete */}
        <div className="flex items-center justify-between gap-3 ml-[1.75rem]">
          <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => updateQuantity(item.id, item.cantidad - 1)}
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
              disabled={loading}
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
            onClick={() => removeItem(item.id)}
            disabled={loading}
            aria-label={`Eliminar ${product?.titulo ?? 'producto'}`}
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
            {variant && variantAttrs.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {variantAttrs.map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              ${item.precio_unitario.toLocaleString('es-AR')} c/u
            </p>
          </div>

          <div className="flex items-center justify-between mt-3 gap-2">
            <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => updateQuantity(item.id, item.cantidad - 1)}
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
                disabled={loading}
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
                onClick={() => removeItem(item.id)}
                disabled={loading}
                aria-label={`Eliminar ${product?.titulo ?? 'producto'}`}
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
