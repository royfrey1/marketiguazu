import { supabase } from '../lib/supabase/client'

export interface ShippingQuoteItem {
  productId: number
  variantId: number | null
  quantity: number
}

export interface ShippingQuoteRequest {
  addressId: number
  shippingMethodId: string
  items: ShippingQuoteItem[]
}

export interface ShippingQuote {
  provider: string
  shippingCost: number
  currency: string
  serviceType: string
  serviceName: string
  deliveredType: 'D' | 'S'
  validTo: string
}

export type ShippingQuoteErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_PAYLOAD'
  | 'INVALID_SHIPPING_METHOD'
  | 'ADDRESS_NOT_FOUND'
  | 'INVALID_POSTAL_CODE'
  | 'ORIGIN_POSTAL_CODE_NOT_CONFIGURED'
  | 'CORREO_ARGENTINO_NOT_CONFIGURED'
  | 'CORREO_ARGENTINO_AUTH_ERROR'
  | 'PRODUCT_NOT_FOUND'
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_PRODUCT_MISMATCH'
  | 'PRODUCT_INACTIVE'
  | 'PRODUCT_SHIPPING_DATA_MISSING'
  | 'PACKAGE_DATA_INVALID'
  | 'CORREO_ARGENTINO_QUOTE_ERROR'
  | 'CORREO_ARGENTINO_TIMEOUT'
  | 'QUOTE_RESPONSE_INVALID'
  | 'NO_RATE_AVAILABLE'
  | 'NO_HOME_DELIVERY_RATE'
  | 'INTERNAL_ERROR'

export interface ShippingQuoteError {
  code: ShippingQuoteErrorCode
  message: string
}

export interface ShippingQuoteResult {
  success: boolean
  data?: ShippingQuote
  error?: ShippingQuoteError
}

export function isShippingQuoteExpired(validTo: string): boolean {
  return Date.now() >= Date.parse(validTo)
}

export const shippingService = {
  async getQuote(request: ShippingQuoteRequest): Promise<ShippingQuoteResult> {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token

    if (!token) {
      return {
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Necesitás iniciar sesión.' },
      }
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const functionUrl = `${supabaseUrl}/functions/v1/create-quote`

    const resp = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    const body = await resp.json()

    if (!resp.ok || body.success === false) {
      return {
        success: false,
        error: body.error || { code: 'INTERNAL_ERROR', message: 'Error desconocido' },
      }
    }

    return {
      success: true,
      data: body as ShippingQuote,
    }
  },
}
