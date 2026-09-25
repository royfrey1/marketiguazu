import { Check } from 'lucide-react'

interface Step {
  number: string
  label: string
}

interface CartStepsProps {
  activeStep?: number
  horizontal?: boolean
}

const steps: Step[] = [
  { number: '01', label: 'Carrito' },
  { number: '02', label: 'Envío' },
  { number: '03', label: 'Pago' },
]

function HorizontalSteps({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex items-center justify-between px-1 py-3 gap-1">
      {steps.map((step, idx) => {
        const isActive = idx === activeStep
        const isCompleted = idx < activeStep
        const isFuture = idx > activeStep

        return (
          <div key={step.number} className="flex items-center gap-1.5 flex-1">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                isActive
                  ? 'bg-accent text-white'
                  : isCompleted
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-300'
              }`}
            >
              {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : step.number}
            </span>
            <span
              className={`text-[11px] font-semibold truncate ${
                isActive ? 'text-accent' : isCompleted ? 'text-primary' : 'text-gray-300'
              }`}
            >
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-px mx-1 ${isFuture ? 'bg-gray-100' : 'bg-primary-light'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function CartSteps({ activeStep = 0, horizontal = false }: CartStepsProps) {
  if (horizontal) {
    return <HorizontalSteps activeStep={activeStep} />
  }

  return (
    <div className="hidden lg:block">
      <h2 className="text-meta mb-5">Compra</h2>
      <div className="space-y-1">
        {steps.map((step, idx) => {
          const isActive = idx === activeStep
          const isCompleted = idx < activeStep
          const isFuture = idx > activeStep

          return (
            <div
              key={step.number}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-accent/10'
                  : isFuture
                    ? 'text-gray-300 cursor-not-allowed'
                    : ''
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : isCompleted
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-300'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : step.number}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isActive ? 'text-accent' : isCompleted ? 'text-primary' : ''
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CartStepsMobile({ activeStep = 0 }: CartStepsProps) {
  return (
    <div className="flex lg:hidden items-center justify-center px-1 py-2 gap-8 sm:gap-10">
      {steps.map((step, idx) => {
        const isActive = idx === activeStep
        const isCompleted = idx < activeStep

        return (
          <div key={step.number} className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <span
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 transition-colors ${
                isActive
                  ? 'bg-accent text-white'
                  : isCompleted
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-300'
              }`}
            >
              {isCompleted ? <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} /> : step.number}
            </span>
            <span
              className={`text-[10px] sm:text-[11px] font-semibold truncate ${
                isActive ? 'text-accent' : isCompleted ? 'text-primary' : 'text-gray-300'
              }`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
