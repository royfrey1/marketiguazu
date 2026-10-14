import { useContext } from 'react'
import { CartRemovalContext } from '../components/cart/CartRemovalContext'

/** Quitar una línea del carrito con confirmación y "Deshacer" (requiere CartRemovalProvider) */
export default function useRemoveCartItem() {
  const context = useContext(CartRemovalContext)
  if (!context) {
    throw new Error('useRemoveCartItem debe usarse dentro de un CartRemovalProvider')
  }
  return context.requestRemove
}
