import { useContext } from 'react'
import { CartContext } from '../components/cart/CartContext'

export default function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart debe usarse dentro de un CartProvider')
  }
  return context
}
