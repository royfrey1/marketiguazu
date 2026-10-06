import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase/client'
import {
  OPEN_WITHDRAWAL_STATUSES,
  type WithdrawalAdminFilter,
  type WithdrawalError,
  type WithdrawalErrorCode,
  type WithdrawalReceipt,
  type WithdrawalRequestPayload,
  type WithdrawalRow,
  type WithdrawalStatus,
} from '../types/withdrawal'

const NETWORK_ERROR: WithdrawalError = {
  code: 'NETWORK_ERROR',
  message: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.',
}

const UNEXPECTED_ERROR: WithdrawalError = {
  code: 'INTERNAL_ERROR',
  message: 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.',
}

const KNOWN_CODES: WithdrawalErrorCode[] = [
  'INVALID_PAYLOAD', 'INVALID_ORDER_ITEMS', 'ORDER_NOT_FOUND', 'ORDER_NOT_ELIGIBLE', 'RATE_LIMITED', 'INTERNAL_ERROR',
]

function isReceipt(value: unknown): value is WithdrawalReceipt {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.numero === 'string'
    && typeof v.numero_pedido === 'string'
    && typeof v.created_at === 'string'
    && typeof v.within_deadline === 'boolean'
    && typeof v.already_requested === 'boolean'
}

/** Normaliza cualquier error de la función a { code, message } (el message del server se muestra tal cual). */
async function toWithdrawalError(error: unknown): Promise<WithdrawalError> {
  if (error instanceof FunctionsHttpError) {
    try {
      // En errores no-2xx el cuerpo { code, message } viene en error.context (Response)
      const body = await (error.context as Response).json() as { code?: unknown; message?: unknown }
      if (typeof body?.message === 'string' && body.message) {
        const code = typeof body.code === 'string' && (KNOWN_CODES as string[]).includes(body.code)
          ? body.code as WithdrawalErrorCode
          : 'INTERNAL_ERROR'
        return { code, message: body.message }
      }
    } catch {
      // cuerpo vacío o JSON inválido
    }
    return UNEXPECTED_ERROR
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) return NETWORK_ERROR
  return UNEXPECTED_ERROR
}

/** Mensajes claros para los errores del RPC admin_update_withdrawal. */
function adminUpdateErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'No tenés permisos de administrador para gestionar solicitudes.'
  if (error.code === 'P0001') {
    return /no encontrada/i.test(error.message)
      ? 'La solicitud ya no existe. Actualizá la lista y probá de nuevo.'
      : 'El estado elegido no es válido.'
  }
  return error.message
}

export interface WithdrawalItemSummary {
  id: number
  nombre_producto: string
  variante_nombre: string | null
  cantidad: number
}

export const withdrawalService = {
  /**
   * Alta de la solicitud (botón de arrepentimiento). Con sesión, invoke manda el
   * token del usuario; sin sesión manda la anon key, que la función trata como
   * "sin sesión" (pide email).
   */
  async requestWithdrawal(
    payload: WithdrawalRequestPayload
  ): Promise<{ data: WithdrawalReceipt | null; error: WithdrawalError | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('request-withdrawal', { body: payload })
      if (error) return { data: null, error: await toWithdrawalError(error) }
      if (!isReceipt(data)) return { data: null, error: UNEXPECTED_ERROR }
      return { data, error: null }
    } catch {
      return { data: null, error: NETWORK_ERROR }
    }
  },

  /** Solicitudes del usuario logueado (opcionalmente de un pedido), más nuevas primero. */
  async listMyWithdrawals(orderId?: number): Promise<{ data: WithdrawalRow[]; error: Error | null }> {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id
    if (!userId) return { data: [], error: null }

    let query = supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (orderId != null) query = query.eq('order_id', orderId)

    const { data, error } = await query
    if (error) return { data: [], error: new Error(error.message) }
    return { data: data ?? [], error: null }
  },

  // ── Admin (RLS: is_admin() ve todas) ────────────────────────────────────

  async listWithdrawalsAdmin(
    filter: WithdrawalAdminFilter = 'open'
  ): Promise<{ data: WithdrawalRow[]; error: Error | null }> {
    let query = supabase
      .from('withdrawal_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter === 'open') query = query.in('status', OPEN_WITHDRAWAL_STATUSES)
    else if (filter !== 'all') query = query.eq('status', filter)

    const { data, error } = await query
    if (error) return { data: [], error: new Error(error.message) }
    return { data: data ?? [], error: null }
  },

  /** Cantidad de solicitudes sin atender (status = received). */
  async countOpenWithdrawalsAdmin(): Promise<{ count: number | null; error: Error | null }> {
    const { count, error } = await supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'received')
    if (error) return { count: null, error: new Error(error.message) }
    return { count: count ?? 0, error: null }
  },

  /** Solicitud abierta (received / in_progress) de un pedido, si existe (hay a lo sumo una). */
  async getOpenWithdrawalForOrderAdmin(orderId: number): Promise<{ data: WithdrawalRow | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('order_id', orderId)
      .in('status', OPEN_WITHDRAWAL_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  },

  /** Productos solicitados (order_item_ids null = todos los del pedido) y teléfono de la dirección de envío. */
  async getWithdrawalContextAdmin(
    orderId: number,
    orderItemIds: number[] | null
  ): Promise<{ items: WithdrawalItemSummary[]; telefono: string | null; error: Error | null }> {
    let itemsQuery = supabase
      .from('order_items')
      .select('id, nombre_producto, variante_nombre, cantidad')
      .eq('order_id', orderId)
      .order('id', { ascending: true })
    if (orderItemIds && orderItemIds.length > 0) itemsQuery = itemsQuery.in('id', orderItemIds)

    const [itemsRes, orderRes] = await Promise.all([
      itemsQuery,
      supabase.from('orders').select('direccion_envio').eq('id', orderId).maybeSingle(),
    ])

    const error = itemsRes.error ?? orderRes.error
    const address = orderRes.data?.direccion_envio as Record<string, unknown> | null | undefined
    const telefono = typeof address?.telefono === 'string' && address.telefono.trim() ? address.telefono.trim() : null

    return {
      items: (itemsRes.data ?? []) as WithdrawalItemSummary[],
      telefono,
      error: error ? new Error(error.message) : null,
    }
  },

  async updateWithdrawalAdmin(
    id: number,
    status: WithdrawalStatus,
    notes: string | null
  ): Promise<{ data: WithdrawalRow | null; error: string | null }> {
    const { data, error } = await supabase.rpc('admin_update_withdrawal', {
      p_id: id,
      p_status: status,
      p_notes: notes,
    })
    if (error) return { data: null, error: adminUpdateErrorMessage(error) }
    return { data: data as unknown as WithdrawalRow, error: null }
  },
}
