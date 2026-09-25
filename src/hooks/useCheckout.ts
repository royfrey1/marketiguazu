import { useContext } from 'react'
import { CheckoutContext } from '../components/checkout/CheckoutContext'

export default function useCheckout() {
  const context = useContext(CheckoutContext)
  if (!context) {
    throw new Error('useCheckout debe usarse dentro de un CheckoutProvider')
  }
  return context
}
