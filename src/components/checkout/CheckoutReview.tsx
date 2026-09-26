import { Link } from 'react-router-dom'
import { MapPin, Truck, ShoppingBag, FileText, Pencil } from 'lucide-react'
import useCart from '../../hooks/useCart'
import useCheckout from '../../hooks/useCheckout'
import { getShippingMethodById } from '../../data/shippingMethods'
import { productImagesService } from '../../services/productImages.service'

interface CheckoutReviewProps {
  onEditAddress: () => void
}

export default function CheckoutReview({ onEditAddress }: CheckoutReviewProps) {
  const { items, subtotal } = useCart()
  const { selectedAddress, selectedShippingMethodId } = useCheckout()
  const shippingMethod = selectedShippingMethodId ? getShippingMethodById(selectedShippingMethodId) : null

  return (
    <div className="space-y-5">
      {/* 1. Productos */}
      <section className="rounded-2xl border border-gray-100 p-5 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light/20 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-primary-dark">Productos</h2>
              <p className="text-xs text-gray-400">{items.length} producto{items.length !== 1 ? 's' : ''} en tu carrito</p>
            </div>
          </div>
          <Link
            to="/carrito"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors shrink-0"
          >
            <Pencil className="w-3 h-3" />
            Editar
          </Link>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const product = item.products
            if (!product) return null

            const imageUrl = productImagesService.resolveImageUrl(
              product.product_images,
              product.imagen_url
            )
            const subtotalItem = item.precio_unitario * item.cantidad

            return (
              <div key={item.id} className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary-light/10 border border-primary-light/20 overflow-hidden shrink-0">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.titulo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      —
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary-dark truncate">{product.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    x{item.cantidad} × ${item.precio_unitario.toLocaleString('es-AR')}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary-dark shrink-0">
                  ${subtotalItem.toLocaleString('es-AR')}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 2. Dirección de entrega */}
      <section className="rounded-2xl border border-gray-100 p-5 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light/20 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-primary-dark">Dirección de entrega</h2>
          </div>
          <button
            type="button"
            onClick={onEditAddress}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Editar
          </button>
        </div>

        {selectedAddress ? (
          <div className="ml-[3.25rem] space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-primary-dark">{selectedAddress.nombre}</p>
              {selectedAddress.es_default && (
                <span className="text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                  Principal
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {selectedAddress.calle} {selectedAddress.numero}
              {selectedAddress.piso && `, Piso ${selectedAddress.piso}`}
              {selectedAddress.departamento && `, Dto ${selectedAddress.departamento}`}
            </p>
            <p className="text-sm text-gray-600">
              {selectedAddress.ciudad}, {selectedAddress.provincia} {selectedAddress.codigo_postal}
            </p>
            <p className="text-xs text-gray-400">{selectedAddress.pais}</p>
            {selectedAddress.telefono && (
              <p className="text-xs text-gray-400">Tel: {selectedAddress.telefono}</p>
            )}
          </div>
        ) : (
          <p className="ml-[3.25rem] text-sm text-gray-400">No hay dirección seleccionada.</p>
        )}
      </section>

      {/* 3. Método de envío */}
      <section className="rounded-2xl border border-gray-100 p-5 sm:p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary-light/20 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-primary-dark">Método de envío</h2>
        </div>

        {shippingMethod ? (
          <div className="ml-[3.25rem] space-y-0.5">
            <p className="text-sm font-bold text-primary-dark">{shippingMethod.name}</p>
            <p className="text-sm text-gray-600">{shippingMethod.description}</p>
            <p className="text-xs text-gray-400">{shippingMethod.estimatedDays}</p>
          </div>
        ) : (
          <p className="ml-[3.25rem] text-sm text-gray-400">Envío gratis con Correo Argentino.</p>
        )}
      </section>

      {/* 4. Resumen de importes */}
      <section className="rounded-2xl border border-primary-light/30 bg-primary-light/10 p-5 sm:p-6 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-sm sm:text-base font-bold text-primary-dark">Importes</h2>
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-gray-600">Subtotal ({items.length} producto{items.length !== 1 ? 's' : ''})</span>
            <span className="font-semibold text-primary-dark">${subtotal.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Envío</span>
            <span className="text-gray-400">Gratis</span>
          </div>
          <div className="border-t border-primary-light/30 pt-2.5 mt-2.5">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm font-bold text-primary-dark">Total</span>
              <span className="text-sm font-bold text-primary-dark">${subtotal.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
