import { Link } from 'react-router-dom'
import { ShoppingBag, ArrowRight } from 'lucide-react'
import Button from '../ui/Button'

export default function CartEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
        <ShoppingBag className="w-8 h-8 text-gray-300" />
      </div>
      <h2 className="text-h3 text-xl font-bold text-primary-dark mb-2">
        Tu carrito está vacío
      </h2>
      <p className="text-body text-gray-500 mb-8 max-w-sm leading-relaxed">
        Agregá productos desde nuestra tienda para comenzar tu compra.
      </p>
      <Link to="/">
        <Button variant="primary" size="lg">
          Explorar productos
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  )
}
