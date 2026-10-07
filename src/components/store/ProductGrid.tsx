import type { ReactNode } from 'react'

export type ProductGridVariant = 'full' | 'withSidebar'

// Mismo gap en todos lados. 2 columnas en mobile; la sidebar de búsqueda/categoría
// aparece recién en lg, por eso en md las dos variantes usan 3 columnas.
const GRID_CLASSES: Record<ProductGridVariant, string> = {
  full: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5',
  withSidebar: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-5',
}

/** Grilla de ProductCard: 'full' (4 columnas en lg, Home) o 'withSidebar' (3 columnas en lg, búsqueda y categoría). */
export function ProductGrid({ variant = 'full', children }: { variant?: ProductGridVariant; children: ReactNode }) {
  return <div className={GRID_CLASSES[variant]}>{children}</div>
}

/** Placeholder con la misma estructura que ProductCard (imagen cuadrada + texto + botón), para no tener salto de layout. */
export function ProductCardSkeleton() {
  return (
    <div className="h-full flex flex-col animate-pulse" aria-hidden="true">
      <div className="rounded-xl overflow-hidden border border-gray-100 bg-white flex-1 flex flex-col">
        <div className="aspect-square bg-gray-100" />
        {/* Mismo alto que el texto de una card real: categoría + título (2 líneas) + precio */}
        <div className="p-3 sm:p-4 space-y-2">
          <div className="h-3 w-1/3 rounded bg-gray-100" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="h-6 w-1/2 rounded bg-gray-100 mt-4" />
        </div>
      </div>
      <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0">
        <div className="h-9 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ variant = 'full', count = 4 }: { variant?: ProductGridVariant; count?: number }) {
  return (
    <ProductGrid variant={variant}>
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
    </ProductGrid>
  )
}
