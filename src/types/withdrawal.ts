import type { Database } from '../lib/supabase/types'

export type WithdrawalRow = Database['public']['Tables']['withdrawal_requests']['Row']

export type WithdrawalStatus = 'received' | 'in_progress' | 'completed' | 'rejected'

export const WITHDRAWAL_STATUSES: WithdrawalStatus[] = ['received', 'in_progress', 'completed', 'rejected']
export const OPEN_WITHDRAWAL_STATUSES: WithdrawalStatus[] = ['received', 'in_progress']

export const WITHDRAWAL_STATUS_MAP: Record<WithdrawalStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  received: { label: 'Recibida', variant: 'warning' },
  in_progress: { label: 'En gestión', variant: 'info' },
  completed: { label: 'Completada', variant: 'success' },
  rejected: { label: 'Rechazada', variant: 'danger' },
}

export function isWithdrawalStatus(value: string): value is WithdrawalStatus {
  return (WITHDRAWAL_STATUSES as string[]).includes(value)
}

/** Body de la Edge Function request-withdrawal. */
export interface WithdrawalRequestPayload {
  order_numero: string
  nombre: string
  /** Obligatorio solo sin sesión (con sesión la función lo ignora). */
  email?: string
  /** null u omitido = todo el pedido. */
  order_item_ids?: number[] | null
  motivo?: string
}

/** Respuesta 200 (alta nueva o solicitud abierta existente). */
export interface WithdrawalReceipt {
  numero: string
  numero_pedido: string
  created_at: string
  within_deadline: boolean
  already_requested: boolean
}

export type WithdrawalErrorCode =
  | 'INVALID_PAYLOAD'
  | 'INVALID_ORDER_ITEMS'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_ELIGIBLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'

export interface WithdrawalError {
  code: WithdrawalErrorCode
  message: string
}

export type WithdrawalAdminFilter = 'open' | 'all' | WithdrawalStatus

/** Evento de ventana que avisa al menú del admin que cambió alguna solicitud (para refrescar el contador). */
export const WITHDRAWALS_CHANGED_EVENT = 'admin:withdrawals-changed'
