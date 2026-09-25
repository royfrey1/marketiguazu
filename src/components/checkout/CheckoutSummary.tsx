import { Package } from 'lucide-react'
import useCart from '../../hooks/useCart'
import { productImagesService } from '../../services/productImages.service'
import { getShippingMethodById } from '../../data/shippingMethods'

interface CheckoutSummaryProps {
  selectedShippingMethodId?: string | null
}

export default function CheckoutSummary({ selectedShippingMethodId }: CheckoutSummaryProps) {
  const { items, itemCount, subtotal } = useCart()
  const shippingMethod = selectedShippingMethodId ? getShippingMethodById(selectedShippingMethodId) : null

  return (
    <div className="bg-primary-light/10 rounded-2xl border border-primary-light/30 p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        <h2 className="text-h3 text-base text-primary-dark">Resumen del pedido</h2>
      </div>

      {/* Totals */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-gray-600 gap-2">
          <span className="shrink-0">Productos ({itemCount})</span>
          <span className="font-semibold text-primary-dark text-right">
            ${subtotal.toLocaleString('es-AR')}
          </span>
        </div>
        <div className="flex justify-between text-gray-500 text-xs gap-2">
          <span className="shrink-0">Envío</span>
          <span className="text-right">
            {shippingMethod ? shippingMethod.name : 'A definir'}
          </span>
        </div>
        {shippingMethod && (
          <div className="flex justify-between text-gray-400 text-xs gap-2">
            <span className="shrink-0">Costo envío</span>
            <span className="text-right">A confirmar</span>
          </div>
        )}
      </div>

      <div className="border-t border-primary-light/30 pt-3">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm font-bold text-primary-dark">Subtotal</span>
          <span className="text-lg font-black text-accent text-right">
            ${subtotal.toLocaleString('es-AR')}
          </span>
        </div>
      </div>

      {/* Product list */}
      {items.length > 0 && (
        <div className="border-t border-primary-light/30 pt-4 space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Productos
          </h3>
          <ul className="space-y-2.5 max-h-52 sm:max-h-60 overflow-y-auto">
            {items.map((item) => {
              const product = item.products
              if (!product) return null

              const imageUrl = productImagesService.resolveImageUrl(
                product.product_images,
                product.imagen_url
              )

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2.5 text-xs"
                >
                  <div className="w-9 h-9 rounded-lg bg-white border border-primary-light/20 overflow-hidden shrink-0">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.titulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
                        —
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 font-medium truncate">
                      {product.titulo}
                    </p>
                    <p className="text-gray-400 text-[10px]">
                      x{item.cantidad}
                    </p>
                  </div>
                  <span className="text-primary-dark font-semibold text-[10px] shrink-0">
                    ${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
