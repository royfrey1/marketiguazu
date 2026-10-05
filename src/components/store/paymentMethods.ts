import { Landmark, Coins, CreditCard, type LucideIcon } from 'lucide-react'

export interface PaymentMethodInfo {
  icon: LucideIcon
  /** Texto completo (franja del Home). */
  label: string
  /** Texto corto (badges de la ficha de producto). */
  shortLabel: string
}

// Siempre en este orden. Las cuotas llevan recargo en la ficha (INSTALLMENT_SURCHARGE_RATE),
// por eso no se anuncian como "sin interés".
export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  { icon: Landmark, label: 'Transferencia en pesos', shortLabel: 'Transferencia' },
  { icon: Coins, label: 'USDT (red TRC20)', shortLabel: 'USDT (TRC20)' },
  { icon: CreditCard, label: '3 cuotas con Mercado Pago', shortLabel: '3 cuotas con Mercado Pago' },
]
