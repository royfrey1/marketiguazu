import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/types'

type OrderRow = Database['public']['Tables']['orders']['Row']
type OrderItemRow = Database['public']['Tables']['order_items']['Row']
type PaymentRow = Database['public']['Tables']['payments']['Row']
type ShipmentRow = Database['public']['Tables']['shipments']['Row']

export type { OrderRow, OrderItemRow, PaymentRow, ShipmentRow }

// ---------------------------------------------------------------------------
// Tipos de retorno para lista y detalle
// Se definen localmente para no exponer campos innecesarios.
// ---------------------------------------------------------------------------

export type OrderListItem = Pick<
  OrderRow,
  | 'id'
  | 'numero_pedido'
  | 'created_at'
  | 'updated_at'
  | 'status'
  | 'payment_status'
  | 'subtotal'
  | 'envio_costo'
  | 'total'
  | 'metodo_envio'
>

export type OrderAdminListItem = Pick<
  OrderRow,
  | 'id'
  | 'numero_pedido'
  | 'user_id'
  | 'created_at'
  | 'updated_at'
  | 'status'
  | 'payment_status'
  | 'subtotal'
  | 'envio_costo'
  | 'total'
  | 'metodo_envio'
> & {
  buyer_nombre: string | null
}

export type AdminOrderFilters = {
  status?: string
  payment_status?: string
  search?: string
}

export type OrderAdminDetail = Pick<
  OrderRow,
  | 'id'
  | 'numero_pedido'
  | 'user_id'
  | 'created_at'
  | 'updated_at'
  | 'status'
  | 'payment_status'
  | 'subtotal'
  | 'envio_costo'
  | 'total'
  | 'metodo_envio'
  | 'direccion_envio'
  | 'notas'
> & {
  buyer_nombre: string | null
  order_items: Pick<
    OrderItemRow,
    | 'id'
    | 'order_id'
    | 'product_id'
    | 'variant_id'
    | 'nombre_producto'
    | 'variante_nombre'
    | 'sku'
    | 'precio_unitario'
    | 'cantidad'
    | 'subtotal'
  >[]
  payments: Pick<
    PaymentRow,
    | 'id'
    | 'provider'
    | 'status'
    | 'amount'
    | 'currency'
    | 'created_at'
    | 'updated_at'
  >[]
  shipments: Pick<
    ShipmentRow,
    | 'id'
    | 'provider'
    | 'provider_tracking_id'
    | 'status'
    | 'costo'
    | 'estimated_days'
    | 'created_at'
    | 'updated_at'
  >[]
}

export type OrderDetail = Pick<
  OrderRow,
  | 'id'
  | 'numero_pedido'
  | 'created_at'
  | 'updated_at'
  | 'status'
  | 'payment_status'
  | 'subtotal'
  | 'envio_costo'
  | 'total'
  | 'metodo_envio'
  | 'direccion_envio'
  | 'notas'
> & {
  order_items: Pick<
    OrderItemRow,
    | 'id'
    | 'order_id'
    | 'product_id'
    | 'variant_id'
    | 'nombre_producto'
    | 'variante_nombre'
    | 'sku'
    | 'precio_unitario'
    | 'cantidad'
    | 'subtotal'
  >[]
  payments: Pick<
    PaymentRow,
    | 'id'
    | 'provider'
    | 'provider_payment_id'
    | 'status'
    | 'amount'
    | 'currency'
  >[]
  shipments: Pick<
    ShipmentRow,
    | 'id'
    | 'provider'
    | 'provider_tracking_id'
    | 'status'
    | 'costo'
    | 'estimated_days'
  >[]
}

// ---------------------------------------------------------------------------
// Select strings — evitan traer campos innecesarios
// ---------------------------------------------------------------------------

const ORDER_LIST_SELECT =
  'id, numero_pedido, created_at, updated_at, status, payment_status, subtotal, envio_costo, total, metodo_envio'

const ORDER_ADMIN_LIST_SELECT =
  'id, numero_pedido, user_id, created_at, updated_at, status, payment_status, subtotal, envio_costo, total, metodo_envio, profiles(nombre)'

const ORDER_DETAIL_SELECT =
  'id, numero_pedido, created_at, updated_at, status, payment_status, subtotal, envio_costo, total, metodo_envio, direccion_envio, notas'

const ORDER_ITEMS_SELECT =
  'id, order_id, product_id, variant_id, nombre_producto, variante_nombre, sku, precio_unitario, cantidad, subtotal'

const PAYMENTS_SELECT = 'id, provider, provider_payment_id, status, amount, currency'

const SHIPMENTS_SELECT = 'id, provider, provider_tracking_id, status, costo, estimated_days'

const ORDER_ADMIN_DETAIL_SELECT =
  'id, numero_pedido, user_id, created_at, updated_at, status, payment_status, subtotal, envio_costo, total, metodo_envio, direccion_envio, notas'

const ADMIN_PAYMENTS_SELECT = 'id, provider, status, amount, currency, created_at, updated_at'

const ADMIN_SHIPMENTS_SELECT = 'id, provider, provider_tracking_id, status, costo, estimated_days, created_at, updated_at'

// ---------------------------------------------------------------------------
// Tipos de estados — usados por las RPCs administrativas
// ---------------------------------------------------------------------------

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'

/** Datos para que el cliente transfiera USDT (payments.metadata de provider='usdt'). */
export interface UsdtPaymentInfo {
  status: string
  amountArs: number
  amountUsdt: number
  exchangeRate: number
  walletAddress: string
  network: string
}

/** Datos para que el cliente transfiera en pesos (payments.metadata de provider='transfer'). */
export interface TransferPaymentInfo {
  status: string
  amountArs: number
  createdAt: string
  titular: string
  alias: string | null
  cbu: string | null
  banco: string | null
  referencia: string
}

export type ShipmentStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'failed'

export type ShipmentProvider =
  | 'via_cargo'
  | 'correo_argentino'
  | 'crucero_express'
  | 'oca'
  | 'otro'

// ---------------------------------------------------------------------------
// Tipos de retorno de RPCs administrativas
// ---------------------------------------------------------------------------

export interface OrderStatusResult {
  order_id: number
  numero_pedido: string
  previous_status: string
  status: string
  payment_status: string
  changed: boolean
}

export interface PaymentStatusResult {
  payment_id: number
  order_id: number
  previous_status: string
  status: string
  order_status: string | null
  order_status_changed: boolean
  changed: boolean
}

export interface CancelOrderResult {
  order_id: number
  numero_pedido: string
  previous_status: string
  status: string
  payment_status: string
  stock_action: string
  cancellation_reason: string | null
  changed: boolean
}

export interface ShipmentCreatedResult {
  shipment_id: number
  order_id: number
  numero_pedido: string
  provider: string
  costo: number
  estimated_days: number | null
  provider_tracking_id: string | null
  status: string
}

export interface ShipmentUpdateResult {
  shipment_id: number
  order_id: number
  updated_fields: string[]
  changed: boolean
}

export interface ShipmentStatusResult {
  shipment_id: number
  order_id: number
  previous_status: string
  status: string
  changed: boolean
}

// ---------------------------------------------------------------------------
// Tipos de input para shipment
// ---------------------------------------------------------------------------

export interface CreateShipmentInput {
  orderId: number
  provider: ShipmentProvider
  costo: number
  estimatedDays?: number | null
  providerTrackingId?: string | null
}

export interface UpdateShipmentInput {
  provider?: ShipmentProvider | null
  costo?: number | null
  estimatedDays?: number | null
  providerTrackingId?: string | null
}

// ---------------------------------------------------------------------------
// Servicio — lectura + mutaciones administrativas
// La seguridad depende exclusivamente de Supabase Auth + RLS.
// El servicio NO recibe userId del frontend como fuente de autoridad.
// ---------------------------------------------------------------------------

export const orderService = {
  /**
   * Obtiene los pedidos del usuario autenticado.
   * RLS filtra automáticamente por user_id = auth.uid().
   */
  async getMyOrders(): Promise<{
    data: OrderListItem[] | null
    error: Error | null
  }> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_LIST_SELECT)
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: new Error(error.message) }

    return { data: data as OrderListItem[], error: null }
  },

  /**
   * Obtiene un pedido concreto del usuario autenticado.
   * Incluye order_items, payments y shipments.
   * RLS filtra por user_id = auth.uid() en orders.
   * Un usuario que intente consultar un orderId ajeno no obtendrá datos.
   */
  /**
   * Pago USDT de un pedido propio, con los datos de transferencia (metadata).
   * RLS (payments_select_own) limita la lectura a pagos de pedidos del usuario.
   */
  async getMyUsdtPayment(
    orderId: number
  ): Promise<{ data: UsdtPaymentInfo | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('payments')
      .select('status, amount, metadata')
      .eq('order_id', orderId)
      .eq('provider', 'usdt')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { data: null, error: new Error(error.message) }
    if (!data) return { data: null, error: new Error('Pago no encontrado') }

    const meta = (data.metadata ?? {}) as Record<string, unknown>
    const amountUsdt = Number(meta.amount_usdt)
    const exchangeRate = Number(meta.exchange_rate)
    const walletAddress = typeof meta.wallet_address === 'string' ? meta.wallet_address : ''
    if (!amountUsdt || !exchangeRate || !walletAddress) {
      return { data: null, error: new Error('Faltan los datos de pago USDT') }
    }

    return {
      data: {
        status: data.status,
        amountArs: data.amount,
        amountUsdt,
        exchangeRate,
        walletAddress,
        network: typeof meta.network === 'string' ? meta.network : 'TRC20',
      },
      error: null,
    }
  },

  /**
   * Pago por transferencia bancaria de un pedido propio, con los datos de la cuenta (metadata).
   * RLS (payments_select_own) limita la lectura a pagos de pedidos del usuario.
   */
  async getMyTransferPayment(
    orderId: number
  ): Promise<{ data: TransferPaymentInfo | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('payments')
      .select('status, amount, created_at, metadata')
      .eq('order_id', orderId)
      .eq('provider', 'transfer')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { data: null, error: new Error(error.message) }
    if (!data) return { data: null, error: new Error('Pago no encontrado') }

    const meta = (data.metadata ?? {}) as Record<string, unknown>
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
    const titular = text(meta.titular)
    const alias = text(meta.alias)
    const cbu = text(meta.cbu)
    const referencia = text(meta.referencia)
    if (!titular || (!alias && !cbu) || !referencia) {
      return { data: null, error: new Error('Faltan los datos de la transferencia') }
    }

    return {
      data: {
        status: data.status,
        amountArs: data.amount,
        createdAt: data.created_at,
        titular,
        alias,
        cbu,
        banco: text(meta.banco),
        referencia,
      },
      error: null,
    }
  },

  async getMyOrderById(
    orderId: number
  ): Promise<{ data: OrderDetail | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `${ORDER_DETAIL_SELECT}, order_items(${ORDER_ITEMS_SELECT}), payments(${PAYMENTS_SELECT}), shipments(${SHIPMENTS_SELECT})`
      )
      .eq('id', orderId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: new Error('Pedido no encontrado') }
      }
      return { data: null, error: new Error(error.message) }
    }

    return { data: data as OrderDetail, error: null }
  },

  /**
   * Obtiene todos los pedidos (vista administrativa).
   * RLS permite lectura global solo a usuarios con role = 'admin'.
   * Devuelve una lista liviana con nombre del comprador (profiles).
   */
  async getAllAdmin(
    page: number = 1,
    pageSize: number = 20,
    filters: AdminOrderFilters = {}
  ): Promise<{ data: OrderAdminListItem[]; total: number; error: Error | null }> {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('orders')
      .select(ORDER_ADMIN_LIST_SELECT, { count: 'exact' })

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters.payment_status && filters.payment_status !== 'all') {
      query = query.eq('payment_status', filters.payment_status)
    }

    if (filters.search && filters.search.trim()) {
      query = query.ilike('numero_pedido', `%${filters.search.trim()}%`)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    const mapped = (data as Record<string, unknown>[] | null)?.map(row => {
      const profiles = row.profiles as { nombre: string | null } | null
      return {
        ...row,
        profiles: undefined,
        buyer_nombre: profiles?.nombre ?? null,
      }
    }) ?? []

    return {
      data: mapped as OrderAdminListItem[],
      total: count ?? 0,
      error: error ? new Error(error.message) : null,
    }
  },

  /**
   * Obtiene el detalle completo de un pedido (vista administrativa).
   * Incluye order_items, payments, shipments y nombre del comprador.
   * RLS permite lectura solo a usuarios con role = 'admin'.
   */
  async getAdminOrderById(
    orderId: number
  ): Promise<{ data: OrderAdminDetail | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `${ORDER_ADMIN_DETAIL_SELECT}, profiles(nombre), order_items(${ORDER_ITEMS_SELECT}), payments(${ADMIN_PAYMENTS_SELECT}), shipments(${ADMIN_SHIPMENTS_SELECT})`
      )
      .eq('id', orderId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: new Error('Pedido no encontrado') }
      }
      return { data: null, error: new Error(error.message) }
    }

    const row = data as Record<string, unknown>
    const profiles = row.profiles as { nombre: string | null } | null

    const result: OrderAdminDetail = {
      ...(row as Omit<typeof row, 'profiles'>),
      profiles: undefined,
      buyer_nombre: profiles?.nombre ?? null,
    } as unknown as OrderAdminDetail

    return { data: result, error: null }
  },

  // ---------------------------------------------------------------------------
  // Mutaciones administrativas
  // ---------------------------------------------------------------------------

  /**
   * Actualiza el estado de un pedido.
   * RPC: update_order_status(p_order_id, p_new_status)
   */
  async updateOrderStatus(
    orderId: number,
    newStatus: OrderStatus
  ): Promise<{ data: OrderStatusResult | null; error: Error | null }> {
    const { data, error } = await supabase
      .rpc('update_order_status', {
        p_order_id: orderId,
        p_new_status: newStatus,
      })
      .overrideTypes<OrderStatusResult, { merge: false }>()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  },

  /**
   * Actualiza el estado de un pago.
   * RPC: update_payment_status(p_payment_id, p_new_status)
   */
  async updatePaymentStatus(
    paymentId: number,
    newStatus: PaymentStatus
  ): Promise<{ data: PaymentStatusResult | null; error: Error | null }> {
    const { data, error } = await supabase
      .rpc('update_payment_status', {
        p_payment_id: paymentId,
        p_new_status: newStatus,
      })
      .overrideTypes<PaymentStatusResult, { merge: false }>()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  },

  /**
   * Cancela un pedido.
   * RPC: cancel_order(p_order_id, p_reason)
   */
  async cancelOrder(
    orderId: number,
    reason?: string
  ): Promise<{ data: CancelOrderResult | null; error: Error | null }> {
    const { data, error } = await supabase
      .rpc('cancel_order', {
        p_order_id: orderId,
        p_reason: reason ?? null,
      })
      .overrideTypes<CancelOrderResult, { merge: false }>()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  },

  /**
   * Crea un shipment para un pedido.
   * RPC: create_shipment(p_order_id, p_provider, p_costo, p_estimated_days, p_provider_tracking_id)
   */
  async createShipment(
    input: CreateShipmentInput
  ): Promise<{ data: ShipmentCreatedResult | null; error: Error | null }> {
    const { data, error } = await supabase
      .rpc('create_shipment', {
        p_order_id: input.orderId,
        p_provider: input.provider,
        p_costo: input.costo,
        p_estimated_days: input.estimatedDays ?? null,
        p_provider_tracking_id: input.providerTrackingId ?? null,
      })
      .overrideTypes<ShipmentCreatedResult, { merge: false }>()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  },

  /**
   * Actualiza datos operativos de un shipment.
   * RPC: update_shipment(p_shipment_id, p_provider, p_costo, p_estimated_days, p_provider_tracking_id)
   */
  async updateShipment(
    shipmentId: number,
    input: UpdateShipmentInput
  ): Promise<{ data: ShipmentUpdateResult | null; error: Error | null }> {
    const { data, error } = await supabase
      .rpc('update_shipment', {
        p_shipment_id: shipmentId,
        p_provider: input.provider ?? null,
        p_costo: input.costo ?? null,
        p_estimated_days: input.estimatedDays ?? null,
        p_provider_tracking_id: input.providerTrackingId ?? null,
      })
      .overrideTypes<ShipmentUpdateResult, { merge: false }>()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  },

  /**
   * Actualiza el estado de un shipment.
   * RPC: update_shipment_status(p_shipment_id, p_new_status)
   */
  async updateShipmentStatus(
    shipmentId: number,
    newStatus: ShipmentStatus
  ): Promise<{ data: ShipmentStatusResult | null; error: Error | null }> {
    const { data, error } = await supabase
      .rpc('update_shipment_status', {
        p_shipment_id: shipmentId,
        p_new_status: newStatus,
      })
      .overrideTypes<ShipmentStatusResult, { merge: false }>()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  },
}
