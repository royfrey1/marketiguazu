import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Truck } from 'lucide-react'
import Button from '../ui/Button'
import useCart from '../../hooks/useCart'
import useAuth from '../../hooks/useAuth'

export default function CartSummary() {
  const { itemCount, subtotal, loading, syncPending, unavailableItems } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()

  const hasUnavailable = unavailableItems.size > 0
  const canContinue = !loading && !syncPending && itemCount > 0 && !!user && !hasUnavailable

  const handleContinue = () => {
    if (canContinue) {
      navigate('/checkout')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
      <h2 className="text-h3 text-base font-bold text-primary-dark">Resumen de compra</h2>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Productos ({itemCount})</span>
          <span className="font-semibold text-primary-dark">
            ${subtotal.toLocaleString('es-AR')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            Envío
          </span>
          <span className="text-xs text-gray-400">A definir en checkout</span>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-bold text-primary-dark">Total</span>
          <span className="text-xl font-black text-accent">
            ${subtotal.toLocaleString('es-AR')}
          </span>
        </div>
      </div>

      <Button
        variant="primary"
        className="w-full"
        disabled={!canContinue}
        onClick={handleContinue}
      >
        Continuar al checkout
        <ArrowRight className="w-4 h-4" />
      </Button>

      {!user && itemCount > 0 && (
        <p className="text-xs text-center text-gray-400">
          Iniciá sesión para continuar con la compra
        </p>
      )}

      {hasUnavailable && (
        <p className="text-xs text-center text-amber-600 font-medium">
          Quitá los productos sin stock para continuar
        </p>
      )}

      <Link
        to="/"
        className="flex items-center justify-center gap-2 w-full text-sm text-accent hover:text-accent/80 font-semibold py-2.5 rounded-xl border border-gray-200 hover:border-accent/30 hover:bg-accent/5 transition-all"
      >
        ← Seguir explorando
      </Link>
    </div>
  )
}
