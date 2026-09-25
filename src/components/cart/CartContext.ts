import { createContext } from 'react'
import type { CartItemWithProduct, LocalCartItem } from '../../types/cart'

export type MergeStrategy = 'local' | 'server' | 'merge'

export interface CartContextType {
  items: CartItemWithProduct[]
  localItems: LocalCartItem[]
  itemCount: number
  subtotal: number
  loading: boolean
  error: string | null
  syncPending: boolean
  unavailableItems: Set<number>
  availabilityChecked: boolean
  addToCart: (productId: number, precioUnitario: number, cantidad?: number, variantId?: number | null) => Promise<void>
  updateQuantity: (itemId: number, cantidad: number) => Promise<void>
  removeItem: (itemId: number) => Promise<void>
  clearCart: () => Promise<void>
  resolveCartConflict: (strategy: MergeStrategy) => Promise<void>
  checkAvailability: () => Promise<void>
}

export const CartContext = createContext<CartContextType | null>(null)
