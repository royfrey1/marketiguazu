import { Link } from 'react-router-dom'
import Seo from '../../components/seo/Seo'
import { motion } from 'framer-motion'
import { ShoppingCart, AlertTriangle } from 'lucide-react'
import useCart from '../../hooks/useCart'
import CartItemCard from '../../components/cart/CartItemCard'
import CartSummary from '../../components/cart/CartSummary'
import CartEmpty from '../../components/cart/CartEmpty'
import CartLoading from '../../components/cart/CartLoading'

function CartPageContent() {
  const { items, itemCount, loading, error, syncPending, unavailableItems, availabilityChecked } = useCart()

  if (loading || syncPending) {
    return (
      <div className="bg-white min-h-screen">
      <div className="store-container m-12">
          <CartLoading />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <Link to="/" className="text-accent text-sm hover:underline font-medium">
            Volver a la tienda
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white min-h-screen">
        <CartEmpty />
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="store-container section-spacing">
        {/* Breadcrumb */}
        <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li><Link to="/" className="breadcrumb-link">Inicio</Link></li>
            <li className="text-gray-300">/</li>
            <li className="breadcrumb-current">Carrito</li>
          </ol>
        </nav>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="w-6 h-6 text-primary-dark" />
            <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark">Tu carrito</h1>
          </div>
          <p className="text-body text-gray-500 ml-9">
            {itemCount} producto{itemCount !== 1 ? 's' : ''}
          </p>
        </motion.div>

        {/* Unavailable items warning */}
        {availabilityChecked && unavailableItems.size > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3" role="alert">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                Hay productos sin stock en tu carrito
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Algunos productos ya no están disponibles. No podrás continuar con la compra hasta que los quites del carrito.
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-8">
          {/* Items list */}
          <div className="flex-1 min-w-0">
            <div className="space-y-4">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <CartItemCard item={item} />
                </motion.div>
              ))}
            </div>

            {/* Mobile summary */}
            <div className="mt-8 lg:hidden">
              <CartSummary />
            </div>
          </div>

          {/* Desktop summary */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24">
              <CartSummary />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// noindex en todos los estados (cargando, error, vacío), no solo en el render principal
export default function CartPage() {
  return (
    <>
      <Seo noindex title="Carrito de compras" />
      <CartPageContent />
    </>
  )
}
