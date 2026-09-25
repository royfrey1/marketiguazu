import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import ProductCard from './ProductCard'
import type { ProductWithPrimaryImage } from '../../services/products.service'

interface PromoBlockProps {
  products: ProductWithPrimaryImage[]
  loading: boolean
}

const DRAG_THRESHOLD_PX = 6

function hasRealOffer(product: ProductWithPrimaryImage) {
  return Boolean(
    product.precio_anterior &&
    product.precio_anterior > product.precio
  )
}

export default function PromoBlock({ products, loading }: PromoBlockProps) {
  const reduceMotion = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({
    active: false,
    moved: false,
    captured: false,
    pointerId: -1,
    startX: 0,
    startScroll: 0,
  })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const updateNav = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateNav()
    const onScroll = () => updateNav()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateNav)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateNav)
    }
  }, [updateNav, products.length])

  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const item = el.querySelector<HTMLElement>('[data-carousel-item]')
    const step = item ? item.offsetWidth + 16 : Math.max(el.clientWidth * 0.8, 200)
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'
    el.scrollBy({ left: dir * step, behavior })
  }, [])

  const handleTrackKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        scrollByDir(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        scrollByDir(-1)
      }
    },
    [scrollByDir]
  )

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = trackRef.current
    if (!el) return
    dragRef.current = {
      active: true,
      moved: false,
      captured: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: el.scrollLeft,
    }
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current
    const d = dragRef.current
    if (!el || !d.active || e.pointerId !== d.pointerId) return
    const dx = e.clientX - d.startX
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return
    d.moved = true
    if (!d.captured) {
      e.currentTarget.setPointerCapture(e.pointerId)
      d.captured = true
      setIsDragging(true)
    }
    el.scrollLeft = d.startScroll - dx
  }, [])

  const finishDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d.active || e.pointerId !== d.pointerId) return
    d.active = false
    if (d.captured && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (d.moved) {
      setIsDragging(false)
      window.setTimeout(() => {
        dragRef.current.moved = false
        dragRef.current.captured = false
      }, 80)
    }
  }, [])

  const handleTrackClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current.moved = false
      dragRef.current.captured = false
      setIsDragging(false)
    }
  }, [])

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.2 },
      }

  const arrowClass =
    'flex items-center justify-center w-11 h-11 rounded-full border border-violet-500/45 bg-white text-violet-600 shadow-sm transition-all duration-200 hover:border-fuchsia-500 hover:text-fuchsia-600 hover:shadow-[0_6px_18px_-6px_rgba(217,70,239,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:border-violet-500/45 disabled:hover:text-violet-600 disabled:hover:shadow-none motion-reduce:transition-none cursor-pointer'

  return (
    <section
      aria-labelledby="promo-offers-title"
      className="relative bg-sale/10 section-spacing overflow-hidden border-t border-white/10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary-light/35 to-transparent"
      />

      <div className="store-container relative">
        <motion.div {...reveal} className="text-center max-w-2xl mx-auto">
          <span className="text-meta text-fuchsia-600">Ofertas de la semana</span>

          <div
            aria-hidden="true"
            className="mx-auto mt-4 mb-5 h-px w-14 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500"
          />

          <h2
            id="promo-offers-title"
            className="text-h2 text-4xl sm:text-5xl md:text-3xl leading-[1.05] text-primary-dark"
          >
            OUTLET DE LA SEMANA
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-fuchsia-500 bg-clip-text text-transparent">
              CON PRECIOS IMPERDIBLES
            </span>
          </h2>

          <p className="text-gray-600 text-sm sm:text-base mt-5 mb-7 max-w-lg mx-auto leading-relaxed">
            Aprovecha los precios de esta semana. Encontrá las mejores ofertas en tecnología seleccionadas para vos.
          </p>

          <Link
            to="/busqueda"
            className="btn-sale ring-1 ring-violet-500/40 hover:ring-fuchsia-500/70 hover:shadow-[0_8px_22px_-8px_rgba(217,70,239,0.5)] motion-reduce:transition-none"
          >
            Ver todas las ofertas
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </motion.div>

        <motion.div {...reveal} transition={{ duration: 0.2, delay: reduceMotion ? 0 : 0.06 }} className="mt-10 sm:mt-12">
          {loading ? (
            <div
              className="flex gap-4 overflow-hidden"
              aria-busy="true"
              aria-label="Cargando productos de ofertas"
            >
              {[1, 2, 3, 4, 5].map(n => (
                <div
                  key={n}
                  className="shrink-0 w-[85%] sm:w-[46%] md:w-[34%] lg:w-[calc(25%-0.75rem)] h-72 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">
              No hay productos disponibles por el momento.
            </p>
          ) : (
            <>
              <div
                ref={trackRef}
                role="region"
                aria-label="Selección de productos en oferta"
                tabIndex={0}
                onKeyDown={handleTrackKeyDown}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onClickCapture={handleTrackClickCapture}
                className={[
                  'flex gap-4 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory pb-2',
                  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-500',
                  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                  isDragging ? 'select-none cursor-grabbing' : 'cursor-grab',
                ].join(' ')}
              >
                {products.map(product => (
                  <div
                    key={product.id}
                    data-carousel-item
                    className="snap-start shrink-0 w-[85%] sm:w-[46%] md:w-[34%] lg:w-[calc(25%-0.75rem)] min-w-[240px] max-w-[340px]"
                  >
                    <div className="h-full rounded-xl border border-violet-400/45 bg-white p-1.5 shadow-[0_4px_18px_-8px_rgba(139,92,246,0.28)] transition-all duration-200 hover:border-fuchsia-500/80 hover:shadow-[0_12px_28px_-10px_rgba(217,70,239,0.4)] focus-within:border-fuchsia-500/80 motion-reduce:transition-none [&_.card]:border-0 [&_.card]:shadow-none [&_.card]:hover:shadow-none">
                      <ProductCard
                        product={product}
                        badge={hasRealOffer(product) ? 'Oferta' : undefined}
                        badgeColor="bg-fuchsia-600"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4 mt-5">
                <button
                  type="button"
                  onClick={() => scrollByDir(-1)}
                  disabled={!canPrev}
                  aria-label="Productos anteriores"
                  className={arrowClass}
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollByDir(1)}
                  disabled={!canNext}
                  aria-label="Productos siguientes"
                  className={arrowClass}
                >
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </section>
  )
}
