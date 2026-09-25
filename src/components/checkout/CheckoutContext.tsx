import { createContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import useAuth from '../../hooks/useAuth'
import useCart from '../../hooks/useCart'
import { getShippingMethodById } from '../../data/shippingMethods'
import { productImagesService } from '../../services/productImages.service'
import {
  shippingService,
  isShippingQuoteExpired,
  type ShippingQuote,
  type ShippingQuoteErrorCode,
} from '../../services/shipping.service'
import type { AddressRow } from '../../services/address.service'
import type {
  CheckoutSnapshot,
  CheckoutValidationResult,
  CheckoutErrorCode,
} from '../../types/checkout'

export interface CheckoutContextType {
  selectedAddress: AddressRow | null
  setSelectedAddress: (address: AddressRow | null) => void
  selectedShippingMethodId: string | null
  setSelectedShippingMethodId: (methodId: string | null) => void
  isPreparingPayment: boolean
  setIsPreparingPayment: (value: boolean) => void
  canProceedToPayment: boolean
  validationError: CheckoutErrorCode | null
  validateCheckout: () => CheckoutValidationResult
  buildSnapshot: () => CheckoutSnapshot | null
  shippingQuote: ShippingQuote | null
  shippingQuoteError: ShippingQuoteErrorCode | null
  isQuotingShipping: boolean
  isShippingQuoteValid: boolean
  fetchShippingQuote: () => Promise<void>
  clearShippingQuote: () => void
}

export const CheckoutContext = createContext<CheckoutContextType | null>(null)

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { items, itemCount, subtotal, loading, syncPending } = useCart()

  const [selectedAddress, setSelectedAddress] = useState<AddressRow | null>(null)
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string | null>(null)
  const [isPreparingPayment, setIsPreparingPayment] = useState(false)
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null)
  const [shippingQuoteError, setShippingQuoteError] = useState<ShippingQuoteErrorCode | null>(null)
  const [isQuotingShipping, setIsQuotingShipping] = useState(false)

  const isShippingQuoteValid = useMemo(() => {
    if (!shippingQuote) return false
    return !isShippingQuoteExpired(shippingQuote.validTo)
  }, [shippingQuote])

  const validateCheckout = useCallback((): CheckoutValidationResult => {
    if (!user) return { valid: false, error: 'AUTH_REQUIRED' }
    if (loading || syncPending) return { valid: false, error: 'CHECKOUT_NOT_READY' }
    if (itemCount === 0) return { valid: false, error: 'EMPTY_CART' }
    if (items.some(item => !item.products || !item.products.activo)) {
      return { valid: false, error: 'INVALID_CART' }
    }
    if (items.some(item => {
      if (!item.products) return true
      const expectedPrice = item.variant_id != null
        ? item.product_variants?.precio
        : item.products.precio
      return expectedPrice == null || item.precio_unitario !== expectedPrice
    })) {
      return { valid: false, error: 'PRICE_CHANGED' }
    }
    if (!selectedAddress) return { valid: false, error: 'ADDRESS_REQUIRED' }
    if (!selectedShippingMethodId) return { valid: false, error: 'SHIPPING_METHOD_REQUIRED' }
    return { valid: true, error: null }
  }, [user, loading, syncPending, itemCount, items, selectedAddress, selectedShippingMethodId])

  const canProceedToPayment = useMemo(() => {
    return validateCheckout().valid
  }, [validateCheckout])

  const validationError = useMemo(() => {
    return validateCheckout().error
  }, [validateCheckout])

  const clearShippingQuote = useCallback(() => {
    setShippingQuote(null)
    setShippingQuoteError(null)
  }, [])

  const fetchShippingQuote = useCallback(async () => {
    if (!selectedAddress || !selectedShippingMethodId || items.length === 0) return

    setIsQuotingShipping(true)
    setShippingQuoteError(null)

    try {
      const quoteItems = items
        .filter(item => item.products && item.products.activo)
        .map(item => ({
          productId: item.product_id,
          variantId: item.variant_id ?? null,
          quantity: item.cantidad,
        }))

      const result = await shippingService.getQuote({
        addressId: selectedAddress.id,
        shippingMethodId: selectedShippingMethodId,
        items: quoteItems,
      })

      if (result.success && result.data) {
        setShippingQuote(result.data)
        setShippingQuoteError(null)
      } else {
        setShippingQuote(null)
        setShippingQuoteError(result.error?.code || 'INTERNAL_ERROR')
      }
    } catch {
      setShippingQuote(null)
      setShippingQuoteError('INTERNAL_ERROR')
    } finally {
      setIsQuotingShipping(false)
    }
  }, [selectedAddress, selectedShippingMethodId, items])

  const buildSnapshot = useCallback((): CheckoutSnapshot | null => {
    const validation = validateCheckout()
    if (!validation.valid || !user || !selectedAddress || !selectedShippingMethodId) {
      return null
    }

    const shippingMethod = getShippingMethodById(selectedShippingMethodId)
    if (!shippingMethod) return null

    const checkoutItems = items
      .filter(item => item.products && item.products.activo)
      .map(item => {
        const product = item.products!
        const imageUrl = productImagesService.resolveImageUrl(
          product.product_images,
          product.imagen_url
        )
        const variant = item.product_variants
        const variantAtributos = variant?.atributos &&
          typeof variant.atributos === 'object' &&
          !Array.isArray(variant.atributos)
            ? variant.atributos as Record<string, string>
            : null
        return {
          id: item.id,
          productId: product.id,
          titulo: product.titulo,
          slug: product.slug,
          imagenUrl: imageUrl,
          cantidad: item.cantidad,
          precioUnitario: item.precio_unitario,
          subtotal: item.precio_unitario * item.cantidad,
          variantId: item.variant_id ?? null,
          variantNombre: variant?.nombre ?? null,
          variantAtributos,
        }
      })

    const validQuote = isShippingQuoteValid ? shippingQuote : null

    return {
      userId: user.id,
      items: checkoutItems,
      itemCount,
      subtotal,
      selectedAddress,
      selectedShippingMethod: shippingMethod,
      shippingCost: validQuote?.shippingCost ?? null,
      total: validQuote ? subtotal + validQuote.shippingCost : null,
      createdAt: new Date().toISOString(),
    }
  }, [validateCheckout, user, selectedAddress, selectedShippingMethodId, items, itemCount, subtotal, shippingQuote, isShippingQuoteValid])

  return (
    <CheckoutContext.Provider
      value={{
        selectedAddress,
        setSelectedAddress,
        selectedShippingMethodId,
        setSelectedShippingMethodId,
        isPreparingPayment,
        setIsPreparingPayment,
        canProceedToPayment,
        validationError,
        validateCheckout,
        buildSnapshot,
        shippingQuote,
        shippingQuoteError,
        isQuotingShipping,
        isShippingQuoteValid,
        fetchShippingQuote,
        clearShippingQuote,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  )
}
