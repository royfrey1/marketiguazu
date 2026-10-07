import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { productsService, type ProductWithPrimaryImage } from '../../services/products.service'
import ProductFavorite from '../product/ProductFavorite'
import { getCategoryIcon } from '../../lib/categoryIcons'

interface ProductCardProps {
  product: ProductWithPrimaryImage
  badge?: string
  badgeColor?: string
}

export default function ProductCard({ product, badge, badgeColor = 'bg-accent' }: ProductCardProps) {
  const imageUrl = productsService.resolveImageUrl(product)
  const productUrl = `/producto/${product.slug}`
  const outOfStock = !product.available || product.available <= 0

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
      <Link
        to={productUrl}
        className="card group h-full flex flex-col relative flex-1"
      >
        <ProductFavorite productId={product.id} />

        {badge && (
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
            {product.precio_anterior && product.precio_anterior > product.precio && (
              <span className="text-price-strike block">
                ${product.precio_anterior.toLocaleString('es-AR')}
              </span>
            )}
            <p className="text-price">
              ${product.precio?.toLocaleString('es-AR')}
            </p>
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
