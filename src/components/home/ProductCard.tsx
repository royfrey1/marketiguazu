import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { productsService, type ProductWithPrimaryImage } from '../../services/products.service'
import ProductFavorite from '../product/ProductFavorite'
import { getCategoryIcon } from '../../lib/categoryIcons'
import { getCardOffer, type OfferContext } from '../../lib/offers'

interface ProductCardProps {
  product: ProductWithPrimaryImage
  badge?: string
  badgeColor?: string
  /** 'offers': bloque de ofertas y modo ofertas; 'catalog' (por defecto): resto de la tienda */
  offerContext?: OfferContext
}

export default function ProductCard({ product, badge, badgeColor = 'bg-accent', offerContext = 'catalog' }: ProductCardProps) {
  const imageUrl = productsService.resolveImageUrl(product)
  const offer = getCardOffer(product, offerContext)
  // Oferta de variante (contexto ofertas): la ficha abre con esa variante seleccionada
  const productUrl = `/producto/${product.slug}${offer.variantId ? `?variante=${offer.variantId}` : ''}`
  const outOfStock = !product.available || product.available <= 0

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
      <Link
        to={productUrl}
        className="card group h-full flex flex-col relative flex-1"
      >
        <ProductFavorite productId={product.id} />

        {/* El badge de oferta reemplaza al decorativo (comparten la esquina) */}
        {offer.badge ? (
          <span className="badge-product bg-fuchsia-700">
            Oferta{offer.descuento !== null && <> -{offer.descuento}%</>}
          </span>
        ) : badge && (
          <span className={`badge-product ${badgeColor}`}>
            {badge}
          </span>
        )}

        {/* Imagen cuadrada y entera (object-contain), con poco aire; el zoom del hover queda contenido por overflow-hidden */}
        <div className="aspect-square bg-white p-2 sm:p-3 overflow-hidden relative shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.titulo}
              loading="lazy"
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {product.categories?.slug ? (() => {
                const catIconUrl = getCategoryIcon(product.categories.slug)
                return catIconUrl ? (
                  <img src={catIconUrl} alt="" className="w-16 h-16 object-contain text-gray-300" />
                ) : (
                  <span className="text-4xl text-gray-300">📦</span>
                )
              })() : (
                <span className="text-4xl text-gray-300">📦</span>
              )}
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 flex flex-col flex-1">
          {product.categories && (
            <p className="text-category mb-1.5 line-clamp-1">
              {product.categories.nombre}
            </p>
          )}

          <h3 className="text-primary-dark font-bold text-sm leading-snug line-clamp-2 mb-3 group-hover:text-accent transition-colors">
            {product.titulo}
          </h3>

          <div className="mt-auto">
            {offer.precioAnterior !== null && (
              <span className="text-price-strike block">
                <span className="sr-only">Precio anterior: </span>
                ${offer.precioAnterior.toLocaleString('es-AR')}
              </span>
            )}
            <p className="text-price">
              {offer.desde && <><span className="text-xs font-bold text-gray-500">desde</span>{' '}</>}
              ${offer.precio?.toLocaleString('es-AR')}
            </p>
            {offer.variantes && (
              <p className="text-xs font-medium text-fuchsia-700">{offer.variantes}</p>
            )}
            {outOfStock && (
              <p className="text-xs font-medium text-red-500 mt-1">Sin stock</p>
            )}
          </div>
        </div>
      </Link>

      {/* Llamado a la acción: link hermano del Link principal (no anidado). La elección de
          variante y el agregado al carrito se hacen en la ficha del producto. */}
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        <Link
          to={productUrl}
          aria-label={`Ver producto ${product.titulo}`}
          className="btn-card w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ver producto
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}
