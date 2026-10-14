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
  /** true si la línea se quitó; false si falló (el error queda en `error`) */
  removeItem: (itemId: number) => Promise<boolean>
  clearCart: () => Promise<void>
  resolveCartConflict: (strategy: MergeStrategy) => Promise<void>
  /** Logueado: revisa el stock de las líneas. Invitado: pide (o refresca) los detalles y el stock de sus líneas */
  checkAvailability: () => Promise<void>
  /** Invitado: guarda en localStorage los precios vigentes antes de ir a iniciar sesión */
  syncGuestPrices: () => void
}

export const CartContext = createContext<CartContextType | null>(null)
