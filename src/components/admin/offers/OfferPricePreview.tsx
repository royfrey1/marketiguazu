import { AlertTriangle, BadgePercent } from 'lucide-react'
import { HIGH_DISCOUNT_PCT, formatArs, offerDiscountPct, offerPriceError } from '../../../lib/offers'

interface OfferPricePreviewProps {
  precio: number | null | undefined
  precioAnterior: number | null | undefined
  /** Muestra el error bloqueante (los formularios con zod ya lo muestran en el campo) */
  showError?: boolean
}

/** Cálculo en vivo de la oferta: precio de oferta, descuento, error y advertencia de descuento alto */
export default function OfferPricePreview({ precio, precioAnterior, showError = true }: OfferPricePreviewProps) {
  const error = offerPriceError(precio, precioAnterior)
  const pct = offerDiscountPct(precio, precioAnterior)

  if (error) {
    return showError ? (
      <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
    ) : null
  }

  return (
    <div className="space-y-1.5" aria-live="polite">
      <p className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-white/70">
        <BadgePercent className="w-4 h-4 text-[#185749] dark:text-[#1CAAA8] shrink-0" aria-hidden="true" />
        <span>
          Precio de oferta: <strong className="font-semibold">{formatArs(precio ?? 0)}</strong>
          {' · '}Descuento: <strong className="font-semibold">{pct}%</strong>
        </span>
      </p>
      {pct !== null && pct >= HIGH_DISCOUNT_PCT && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          Descuento muy alto ({pct}%): verificá que los precios sean correctos.
        </p>
      )}
    </div>
  )
}
