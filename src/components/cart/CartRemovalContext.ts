import { createContext } from 'react'
import type { CartItemWithProduct } from '../../types/cart'

export interface CartRemovalContextType {
  /**
   * Único punto de entrada para quitar una línea del carrito: pide confirmación (salvo que el usuario
   * haya elegido no volver a verla) y después ofrece "Deshacer". `opener` es el botón que lo pidió,
   * para devolverle el foco si se cancela.
   */
  requestRemove: (item: CartItemWithProduct, opener?: HTMLElement | null) => void
}

export const CartRemovalContext = createContext<CartRemovalContextType | null>(null)
