import type { AddressRow } from '../services/address.service'
import type { ShippingMethod } from '../data/shippingMethods'

export type CheckoutErrorCode =
  | 'AUTH_REQUIRED'
  | 'EMPTY_CART'
  | 'INVALID_CART'
  | 'PRICE_CHANGED'
  | 'ADDRESS_REQUIRED'
  | 'SHIPPING_METHOD_REQUIRED'
  | 'CHECKOUT_NOT_READY'

export const CHECKOUT_ERROR_MESSAGES: Record<CheckoutErrorCode, string> = {
  AUTH_REQUIRED: 'Necesitás iniciar sesión para continuar.',
  EMPTY_CART: 'Tu carrito está vacío.',
  INVALID_CART: 'Tu carrito tiene productos inválidos.',
  PRICE_CHANGED: 'El precio de uno de los productos cambió. Revisá tu carrito antes de continuar.',
  ADDRESS_REQUIRED: 'Seleccioná una dirección de envío.',
  SHIPPING_METHOD_REQUIRED: 'Seleccioná un método de envío.',
  CHECKOUT_NOT_READY: 'El checkout no está listo para continuar.',
}

export interface CheckoutCartItem {
  id: number
  productId: number
  titulo: string
  slug: string
  imagenUrl: string | null
  cantidad: number
  precioUnitario: number
  subtotal: number
  variantId: number | null
  variantNombre: string | null
  variantAtributos: Record<string, string> | null
}

export interface CheckoutSnapshot {
  userId: string
  items: CheckoutCartItem[]
  itemCount: number
  subtotal: number
  selectedAddress: AddressRow
  selectedShippingMethod: ShippingMethod
  shippingCost: number | null
  total: number | null
  createdAt: string
}

export interface CheckoutValidationResult {
  valid: boolean
  error: CheckoutErrorCode | null
}
