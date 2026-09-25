import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
import { productsService, type ProductWithPrimaryImage } from '../../services/products.service'
import useCart from '../../hooks/useCart'
import ProductFavorite from '../product/ProductFavorite'
import { getCategoryIcon } from '../../lib/categoryIcons'

interface ProductCardProps {
  product: ProductWithPrimaryImage
  badge?: string
  badgeColor?: string
}

export default function ProductCard({ product, badge, badgeColor = 'bg-accent' }: ProductCardProps) {
  const imageUrl = productsService.resolveImageUrl(product)
  const { addToCart, loading: cartLoading } = useCart()
  const [adding, setAdding] = useState(false)

  const outOfStock = !product.available || product.available <= 0

  const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (adding || cartLoading || !product.activo || outOfStock) return

    setAdding(true)
    try {
      await addToCart(product.id, product.precio, 1, null)
      sileo.success({
        title: 'Producto agregado',
        description: 'El producto fue agregado a tu carrito.',
      })
    } catch (err) {
      sileo.error({
        title: 'No se pudo agregar',
        description: err instanceof Error ? err.message : 'Ocurrió un error inesperado.',
      })
    } finally {
      setAdding(false)
    }
  }, [adding, cartLoading, product.activo, outOfStock, product.id, product.precio, addToCart])

  const isLoading = adding || cartLoading
  const isDisabled = !product.activo || outOfStock

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
      <Link
        to={`/producto/${product.slug}`}
        className="card h-full flex flex-col relative flex-1"
      >
        <ProductFavorite productId={product.id} />

        {badge && (
          <span className={`badge-product ${badgeColor}`}>
            {badge}
          </span>
        )}

        <div className="h-48 sm:h-52 bg-primary-light/10 overflow-hidden relative shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.titulo}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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

        <div className="p-4 flex flex-col flex-1">
          {product.categories && (
            <p className="text-category mb-1.5">
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

      <div className="px-4 pb-4">
        <button
          onClick={handleAddToCart}
          disabled={isDisabled || isLoading}
          aria-label={outOfStock ? 'Producto sin stock' : !product.activo ? 'Producto agotado' : 'Agregar al carrito'}
          className="btn-card w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShoppingCart className="w-4 h-4" />
          )}
          {outOfStock ? 'Sin stock' : !product.activo ? 'Agotado' : adding ? 'Agregando...' : 'Agregar al carrito'}
        </button>
      </div>
    </motion.div>
  )
}
