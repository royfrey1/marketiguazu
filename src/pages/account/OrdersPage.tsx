import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShoppingBag, AlertTriangle, RefreshCw } from 'lucide-react'
import { useOrders } from '../../hooks/useOrders'
import OrderCard from '../../components/account/OrderCard'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'

export default function OrdersPage() {
  const { data: orders, loading, error, refetch } = useOrders()

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="store-container section-spacing">
          <div className="mb-8">
            <Skeleton height="2rem" width="12rem" rounded="lg" />
            <Skeleton height="1rem" width="20rem" className="mt-3" rounded="lg" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-3">
                    <Skeleton height="1.25rem" width="10rem" rounded="lg" />
                    <Skeleton height="0.875rem" width="8rem" rounded="lg" />
                    <div className="flex gap-2">
                      <Skeleton height="1.25rem" width="5rem" rounded="full" />
                      <Skeleton height="1.25rem" width="5.5rem" rounded="full" />
                    </div>
                  </div>
                  <Skeleton height="1.75rem" width="6rem" rounded="lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="store-container section-spacing">
          <div className="mb-8">
            <h1 className="text-h2 text-2xl sm:text-3xl">Mis pedidos</h1>
          </div>
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-700 mb-2">No se pudieron cargar tus pedidos</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">{error}</p>
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="store-container section-spacing">
          <div className="mb-8">
            <h1 className="text-h2 text-2xl sm:text-3xl">Mis pedidos</h1>
            <p className="text-body mt-1">Consultá el estado y el resumen de tus compras.</p>
          </div>
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-600 mb-2">Todavía no tenés pedidos</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              Cuando realices una compra, tus pedidos aparecerán aquí.
            </p>
            <Link to="/" className="btn-primary-sm inline-block">
              Explorar productos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="store-container section-spacing">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-h2 text-2xl sm:text-3xl">Mis pedidos</h1>
          <p className="text-body mt-1">Consultá el estado y el resumen de tus compras.</p>
        </motion.div>

        <div className="space-y-4">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <OrderCard order={order} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
