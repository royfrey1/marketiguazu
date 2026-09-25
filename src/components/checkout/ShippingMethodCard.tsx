import { Truck, Check } from 'lucide-react'
import type { ShippingMethod } from '../../data/shippingMethods'

interface ShippingMethodCardProps {
  method: ShippingMethod
  isSelected: boolean
  onSelect: () => void
}

export default function ShippingMethodCard({ method, isSelected, onSelect }: ShippingMethodCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${method.name}. ${method.description}. ${method.estimatedDays}. Costo a confirmar.`}
      onClick={onSelect}
      className={`
        w-full text-left rounded-xl border p-4 transition-all cursor-pointer
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        ${isSelected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-gray-200 hover:border-primary-light bg-white'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          isSelected ? 'bg-accent/10' : 'bg-primary-light/20'
        }`}>
          <Truck className={`w-5 h-5 ${isSelected ? 'text-accent' : 'text-primary'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-primary-dark">{method.name}</span>
            <span className="text-xs text-gray-400 shrink-0">A confirmar</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{method.description}</p>
          <p className="text-xs text-gray-400 mt-1">{method.estimatedDays}</p>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
          isSelected ? 'border-accent' : 'border-gray-300'
        }`}>
          {isSelected && <Check className="w-3 h-3 text-accent" strokeWidth={3} />}
        </div>
      </div>
    </button>
  )
}
