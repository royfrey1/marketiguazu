import ProductImagesManager from './ProductImagesManager'

interface VariantImagesManagerProps {
  productId: number
  variantId: number
}

/**
 * Galería propia de una variante. Reusa ProductImagesManager limitado a la
 * variante (variant_id), en su versión compacta para usar dentro de un modal.
 */
export default function VariantImagesManager({ productId, variantId }: VariantImagesManagerProps) {
  return <ProductImagesManager productId={productId} variantId={variantId} />
}
