import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'

export default function OrdersSection() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-primary-dark">Mis pedidos</h2>
        <p className="text-sm text-gray-500 mt-0.5">Historial de tus compras.</p>
      </div>

      <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
        <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-4" />
        <h3 className="text-base font-bold text-gray-600 mb-1">Revisá tus pedidos</h3>
        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-4">
          Consultá el estado de tus compras y el historial de pedidos.
        </p>
        <Link to="/pedidos" className="btn-primary-sm inline-block">
          Ver mis pedidos
        </Link>
      </div>
    </div>
  )
}
