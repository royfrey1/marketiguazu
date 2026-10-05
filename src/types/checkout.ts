import type { AddressRow } from '../services/address.service'
import type { ShippingMethod } from '../data/shippingMethods'

export type CheckoutErrorCode =
  | 'AUTH_REQUIRED'
  | 'EMPTY_CART'
  | 'INVALID_CART'
  | 'PRICE_CHANGED'
  | 'ADDRESS_REQUIRED'
  | 'PHONE_REQUIRED'
  | 'SHIPPING_METHOD_REQUIRED'
  | 'CHECKOUT_NOT_READY'

export const CHECKOUT_ERROR_MESSAGES: Record<CheckoutErrorCode, string> = {
  AUTH_REQUIRED: 'Necesitás iniciar sesión para continuar.',
  EMPTY_CART: 'Tu carrito está vacío.',
  INVALID_CART: 'Tu carrito tiene productos inválidos.',
  PRICE_CHANGED: 'El precio de uno de los productos cambió. Revisá tu carrito antes de continuar.',
  ADDRESS_REQUIRED: 'Seleccioná una dirección de envío.',
  PHONE_REQUIRED: 'Agregá un teléfono de contacto a esta dirección para continuar',
  SHIPPING_METHOD_REQUIRED: 'Seleccioná un método de envío.',
  CHECKOUT_NOT_READY: 'El checkout no está listo para continuar.',
}

export type PaymentErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_PAYLOAD'
  | 'EMPTY_CART'
  | 'INVALID_PRODUCT'
  | 'INVALID_VARIANT'
  | 'INVALID_QUANTITY'
  | 'PRICE_CHANGED'
  | 'ADDRESS_NOT_FOUND'
  | 'STOCK_UNAVAILABLE'
  | 'ORDER_CREATION_FAILED'
  | 'PAYMENT_CREATION_FAILED'
  | 'MERCADOPAGO_ERROR'
  | 'EXCHANGE_RATE_ERROR'
  | 'WALLET_NOT_CONFIGURED'
  | 'PENDING_USDT_ORDER'
  | 'INTERNAL_ERROR'

export const PAYMENT_ERROR_MESSAGES: Record<PaymentErrorCode, string> = {
  AUTH_REQUIRED: 'Tu sesión expiró. Iniciá sesión nuevamente para continuar.',
  INVALID_PAYLOAD: 'Los datos del checkout son inválidos. Volvé al carrito y revisá el pedido.',
  EMPTY_CART: 'Tu carrito está vacío.',
  INVALID_PRODUCT: 'Uno de los productos del carrito ya no está disponible.',
  INVALID_VARIANT: 'Una de las variantes del carrito ya no está disponible.',
  INVALID_QUANTITY: 'Las cantidades del carrito son inválidas.',
  PRICE_CHANGED: 'El precio de un producto cambió. Revisá tu carrito antes de continuar.',
  ADDRESS_NOT_FOUND: 'La dirección de envío seleccionada ya no existe. Elegí una nueva.',
  STOCK_UNAVAILABLE: 'No hay stock suficiente para uno de los productos. Ajustá las cantidades.',
  ORDER_CREATION_FAILED: 'No pudimos crear tu pedido. Intentá nuevamente en unos minutos.',
  PAYMENT_CREATION_FAILED: 'No pudimos iniciar el pago. Intentá nuevamente en unos minutos.',
  MERCADOPAGO_ERROR: 'Mercado Pago no pudo procesar la operación. Intentá nuevamente.',
  EXCHANGE_RATE_ERROR: 'No pudimos obtener la cotización de USDT en este momento. Probá de nuevo en unos minutos o pagá con Mercado Pago.',
  WALLET_NOT_CONFIGURED: 'El pago con USDT no está disponible por el momento. Elegí otro método de pago.',
  PENDING_USDT_ORDER: 'Ya tenés un pedido pendiente de pago con USDT.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Intentá nuevamente.',
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
