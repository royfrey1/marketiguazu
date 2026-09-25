import { type ReactNode } from 'react'
import CartSteps, { CartStepsMobile } from '../cart/CartSteps'
import CheckoutSummary from './CheckoutSummary'

interface CheckoutLayoutProps {
  activeStep: number
  selectedShippingMethodId?: string | null
  children: ReactNode
}

export default function CheckoutLayout({ activeStep, selectedShippingMethodId, children }: CheckoutLayoutProps) {
  return (
    <div className="bg-white min-h-screen">
      <div className="store-container section-spacing">
        <CartStepsMobile activeStep={activeStep} />

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Desktop sidebar - step indicator */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-28">
              <CartSteps activeStep={activeStep} />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>

          {/* Desktop sidebar - summary */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-28">
              <CheckoutSummary selectedShippingMethodId={selectedShippingMethodId} />
            </div>
          </aside>

          {/* Mobile summary - below content */}
          <div className="lg:hidden">
            <CheckoutSummary selectedShippingMethodId={selectedShippingMethodId} />
          </div>
        </div>
      </div>
    </div>
  )
}
