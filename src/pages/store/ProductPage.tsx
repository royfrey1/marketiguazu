import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
import { ShoppingCart, Share2, Minus, Plus, Package, ChevronLeft, ChevronRight, Star, MessageSquare, Truck } from 'lucide-react'
import { productsService, type ProductWithPrimaryImage } from '../../services/products.service'
import { productImagesService, type ProductImage } from '../../services/productImages.service'
import { productVariantsService, type VariantWithInventory } from '../../services/productVariants.service'
import { productSpecificationsService, type ProductSpecificationRow } from '../../services/productSpecifications.service'
import useCart from '../../hooks/useCart'
import ProductCard from '../../components/home/ProductCard'
import { ProductGrid } from '../../components/store/ProductGrid'
import ProductImageViewer, { type ProductViewerImage } from '../../components/product/ProductImageViewer'
import VariantDropdown from '../../components/product/VariantDropdown'
import { PAYMENT_METHODS } from '../../components/store/paymentMethods'

const MAX_VISIBLE_THUMBS = 5
const SIN_IMAGENES: ProductImage[] = []
const USDT_METHOD = PAYMENT_METHODS.find(m => m.label.startsWith('USDT'))

type AttributeMap = Record<string, string>

interface AttributeGroup {
  key: string
  values: string[]
}

function extractAttributeGroups(variants: VariantWithInventory[]): AttributeGroup[] {
  const map = new Map<string, Set<string>>()
  for (const v of variants) {
    if (!v.atributos || typeof v.atributos !== 'object') continue
    const attrs = v.atributos as AttributeMap
    for (const [key, val] of Object.entries(attrs)) {
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(val)
    }
  }
  const groups: AttributeGroup[] = []
  for (const [key, vals] of map) {
    groups.push({ key, values: [...vals].sort() })
  }
  return groups
}

function resolveVariant(
  variants: VariantWithInventory[],
  selected: AttributeMap
): VariantWithInventory | null {
  return variants.find(v => {
    if (!v.atributos || typeof v.atributos !== 'object') return false
    const attrs = v.atributos as AttributeMap
    const keys = Object.keys(selected)
    if (keys.length === 0) return false
    return keys.every(k => attrs[k] === selected[k])
  }) || null
}

function getCompatibleValues(
  variants: VariantWithInventory[],
  attributeKey: string,
  currentSelection: AttributeMap
): Set<string> {
  const compatible = new Set<string>()
  for (const v of variants) {
    if (!v.atributos || typeof v.atributos !== 'object') continue
    const attrs = v.atributos as AttributeMap
    const matchesOthers = Object.entries(currentSelection).every(([k, val]) => {
      if (k === attributeKey) return true
      return attrs[k] === val
    })
    if (matchesOthers && attrs[attributeKey] !== undefined) {
      compatible.add(attrs[attributeKey])
    }
  }
  return compatible
}

const INSTALLMENT_COUNT = 3
const INSTALLMENT_SURCHARGE_RATE = 0.20

export default function DetalleProducto() {
  const { id, slug } = useParams<{ id: string; slug: string }>()
  const [producto, setProducto] = useState<ProductWithPrimaryImage | null>(null)
  const [imagenes, setImagenes] = useState<ProductImage[]>([])
  // Galerías propias de variantes, por id de variante (se cargan al seleccionarla)
  const [galeriasVariante, setGaleriasVariante] = useState<Record<number, ProductImage[]>>({})
  const [loading, setLoading] = useState(true)
  // Índice de la foto activa, atado a la galería en la que se eligió: al cambiar de
  // galería (otra variante / producto) se vuelve a la principal de la nueva.
  const [seleccionImagen, setSeleccionImagen] = useState<{ galeria: string; index: number } | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const { addToCart, loading: cartLoading } = useCart()
  const [quantity, setQuantity] = useState(1)

  const [variantes, setVariantes] = useState<VariantWithInventory[]>([])
  const [variantesLoading, setVariantesLoading] = useState(false)
  const [variantesError, setVariantesError] = useState<string | null>(null)
  const [selectedAttributes, setSelectedAttributes] = useState<AttributeMap>({})
  const [variantAvail, setVariantAvail] = useState<Map<number, number>>(new Map())

  const [related, setRelated] = useState<ProductWithPrimaryImage[]>([])
  const [specs, setSpecs] = useState<ProductSpecificationRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function cargarProducto() {
      try {
        let prodData: ProductWithPrimaryImage | null = null

        if (slug) {
          const { data } = await productsService.getBySlug(slug)
          if (!cancelled) prodData = data
        } else if (id) {
          const { data } = await productsService.getById(Number(id))
          if (!cancelled) prodData = data
        }

        if (!cancelled && prodData) {
          setProducto(prodData)
          const { data: imgs } = await productImagesService.getByProductId(prodData.id)
          if (!cancelled && imgs) {
            setImagenes(imgs)
          }

          setVariantesLoading(true)
          setVariantesError(null)
          const { data: vars, error: varsError } = await productVariantsService.getActiveByProductId(prodData.id)
          if (!cancelled) {
            if (varsError) {
              setVariantesError(varsError.message)
            } else {
              setVariantes(vars || [])
            }
            setVariantesLoading(false)
          }

          const availMap = await productsService.getVariantAvailability(prodData.id)
          if (!cancelled) {
            setVariantAvail(availMap)
          }

          const { data: relatedData } = await productsService.getRecent(4)
          if (!cancelled && relatedData) {
            setRelated(relatedData.filter((p: ProductWithPrimaryImage) => p.id !== prodData!.id).slice(0, 4))
          }

          const { data: specsData } = await productSpecificationsService.getByProductId(prodData.id)
          if (!cancelled) {
            setSpecs(specsData || [])
          }
        }
      } catch (error) {
        console.error("Error al cargar:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    cargarProducto()
    return () => { cancelled = true }
  }, [id, slug])

  const hasVariants = variantes.length > 0
  const attributeGroups = useMemo(() => extractAttributeGroups(variantes), [variantes])

  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (autoSelectedRef.current) return
    if (!hasVariants || variantesLoading || variantAvail.size === 0) return
    if (Object.keys(selectedAttributes).length > 0) return
    autoSelectedRef.current = true
    const firstAvailable = variantes.find(v => (variantAvail.get(v.id) ?? 0) > 0)
    if (firstAvailable?.atributos && typeof firstAvailable.atributos === 'object') {
      setSelectedAttributes(firstAvailable.atributos as AttributeMap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVariants, variantesLoading, variantAvail, variantes])

  const selectedVariant = useMemo(() => {
    if (Object.keys(selectedAttributes).length === 0) return null
    return resolveVariant(variantes, selectedAttributes)
  }, [variantes, selectedAttributes])

  const selectedVariantId = selectedVariant?.id
  useEffect(() => {
    if (selectedVariantId == null) return
    let cancelled = false
    productImagesService.getByVariantId(selectedVariantId).then(({ data }) => {
      if (!cancelled) {
        setGaleriasVariante(prev => ({ ...prev, [selectedVariantId]: data ?? [] }))
      }
    })
    return () => { cancelled = true }
  }, [selectedVariantId])

  const imagenesVariante = useMemo(
    () => (selectedVariantId != null ? galeriasVariante[selectedVariantId] : undefined) ?? SIN_IMAGENES,
    [galeriasVariante, selectedVariantId]
  )

  const handleAttributeSelect = useCallback((key: string, value: string) => {
    setSelectedAttributes(prev => {
      if (prev[key] === value) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
    setQuantity(1)
  }, [])

  const effectivePrice = useMemo(() => {
    if (selectedVariant) return selectedVariant.precio
    return producto?.precio ?? 0
  }, [selectedVariant, producto])

  const effectivePriceAnterior = useMemo(() => {
    if (selectedVariant) return selectedVariant.precio_anterior
    return producto?.precio_anterior ?? null
  }, [selectedVariant, producto])

  const installmentAmount = useMemo(
    () => (effectivePrice * (1 + INSTALLMENT_SURCHARGE_RATE)) / INSTALLMENT_COUNT,
    [effectivePrice]
  )

  const effectiveStock = useMemo(() => {
    if (selectedVariant) {
      return variantAvail.get(selectedVariant.id) ?? 0
    }
    if (hasVariants) return 0
    return producto?.available ?? 0
  }, [selectedVariant, hasVariants, variantAvail, producto])

  const handleAddToCart = useCallback(async () => {
    if (!producto?.activo || cartLoading) return
    if (hasVariants && !selectedVariant) {
      sileo.error({
        title: 'Falta seleccionar',
        description: 'Seleccioná una variante para continuar',
      })
      return
    }
    if (effectiveStock <= 0) {
      sileo.error({
        title: 'Sin disponibilidad',
        description: selectedVariant
          ? 'Esta variante no está disponible'
          : 'Este producto no está disponible',
      })
      return
    }
    try {
      await addToCart(producto.id, effectivePrice, quantity, selectedVariant?.id ?? null)
      sileo.success({ title: 'Producto agregado al carrito' })
    } catch (err) {
      sileo.error({
        title: 'No se pudo agregar',
        description: err instanceof Error ? err.message : 'Ocurrió un error inesperado.',
      })
    }
  }, [producto, cartLoading, hasVariants, selectedVariant, effectiveStock, addToCart, effectivePrice, quantity])

  const isVariantProduct = hasVariants || variantesLoading

  const effectiveImage = useMemo(() => {
    if (imagenesVariante.length > 0) {
      return productImagesService.resolveImageUrl(imagenesVariante, selectedVariant?.imagen_url ?? producto?.imagen_url)
    }
    if (selectedVariant?.imagen_url) return selectedVariant.imagen_url
    if (imagenes.length > 0) {
      return productImagesService.resolveImageUrl(imagenes, producto?.imagen_url)
    }
    return productsService.resolveImageUrl(producto)
  }, [selectedVariant, imagenesVariante, imagenes, producto])

  const effectiveAlt = useMemo(() => {
    if (selectedVariant && imagenesVariante.length > 0) {
      return productImagesService.resolveAltText(
        imagenesVariante.find(img => img.es_principal) || imagenesVariante[0],
        selectedVariant.nombre
      )
    }
    if (selectedVariant) return selectedVariant.nombre
    if (imagenes.length > 0) {
      return productImagesService.resolveAltText(
        imagenes.find(img => img.es_principal) || imagenes[0],
        producto?.titulo || ''
      )
    }
    return producto?.titulo || ''
  }, [selectedVariant, imagenesVariante, imagenes, producto])

  const handleShare = async () => {
    const shareData = {
      title: `${producto?.titulo} - Iguazú Marketplace`,
      text: `Mirá ${producto?.titulo} en Iguazú Marketplace`,
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
      }
    } catch (err) {
      console.error('Error al compartir:', err)
    }
  }

  const galeriaImagenes = useMemo(() => {
    if (imagenesVariante.length > 0) return imagenesVariante
    if (selectedVariant?.imagen_url) return []
    if (imagenes.length > 0) return imagenes
    return []
  }, [selectedVariant, imagenesVariante, imagenes])

  const totalGaleria = galeriaImagenes.length
  const galeriaKey = imagenesVariante.length > 0 ? `variante-${selectedVariantId}` : 'producto'
  const imagenActiva = seleccionImagen?.galeria === galeriaKey && seleccionImagen.index < totalGaleria
    ? seleccionImagen.index
    : Math.max(0, galeriaImagenes.findIndex(img => img.es_principal))
  const setImagenActiva = useCallback(
    (index: number) => setSeleccionImagen({ galeria: galeriaKey, index }),
    [galeriaKey]
  )
  const visibleThumbs = galeriaImagenes.slice(0, MAX_VISIBLE_THUMBS)
  const extraPhotos = Math.max(0, totalGaleria - MAX_VISIBLE_THUMBS)

  const viewerImages = useMemo<ProductViewerImage[]>(() => {
    if (galeriaImagenes.length > 0) {
      return galeriaImagenes.map(img => ({
        url: img.url,
        alt: productImagesService.resolveAltText(img, producto?.titulo || ''),
      }))
    }
    if (effectiveImage) {
      return [{ url: effectiveImage, alt: effectiveAlt }]
    }
    return []
  }, [galeriaImagenes, effectiveImage, effectiveAlt, producto?.titulo])

  const openViewer = useCallback(
    (index: number) => {
      if (viewerImages.length === 0) return
      const safeIndex = Math.min(Math.max(0, index), viewerImages.length - 1)
      setViewerIndex(safeIndex)
      setViewerOpen(true)
    },
    [viewerImages.length]
  )

  const prevImage = useCallback(() => {
    setImagenActiva(imagenActiva > 0 ? imagenActiva - 1 : totalGaleria - 1)
  }, [imagenActiva, totalGaleria, setImagenActiva])

  const nextImage = useCallback(() => {
    setImagenActiva(imagenActiva < totalGaleria - 1 ? imagenActiva + 1 : 0)
  }, [imagenActiva, totalGaleria, setImagenActiva])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="store-container py-8 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="bg-gray-100 h-96 lg:h-[500px] rounded-xl animate-pulse" />
            <div className="space-y-4">
              <div className="bg-gray-100 h-4 w-24 rounded animate-pulse" />
              <div className="bg-gray-100 h-8 w-3/4 rounded animate-pulse" />
              <div className="bg-gray-100 h-6 w-32 rounded animate-pulse" />
              <div className="bg-gray-100 h-4 w-48 rounded animate-pulse" />
              <div className="bg-gray-100 h-12 w-full rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="min-h-screen bg-white">
        <div className="store-container py-8 sm:py-10">
          <nav className="breadcrumb">
            <Link to="/" className="breadcrumb-link">Inicio</Link>
          </nav>
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-h3 text-lg mb-2">Producto no encontrado</p>
            <p className="text-body mb-6">El producto que buscás no existe o fue removido.</p>
            <Link to="/busqueda" className="btn-primary">Explorar productos</Link>
          </div>
        </div>
      </div>
    )
  }

  if (id && !slug && producto.slug) {
    return <Navigate to={`/producto/${producto.slug}`} replace />
  }

  const categorySlug = (producto as ProductWithPrimaryImage & { categories?: { slug?: string | null } }).categories?.slug

  const showVariantSelector = hasVariants && !variantesLoading && !variantesError && attributeGroups.length > 0

  return (
    <div className="min-h-screen bg-white">
      <div className="store-container py-8 sm:py-10">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          {categorySlug && producto.categories && (
            <>
              <Link to={`/categoria/${categorySlug}`} className="breadcrumb-link">
                {producto.categories.nombre}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="breadcrumb-current truncate">{producto.titulo}</span>
        </nav>

        {/* Main product section */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          {/* Gallery — desktop: main + thumbnails right; mobile: main + thumbnails below */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col-reverse lg:flex-row gap-3"
          >
            {/* Thumbnails — horizontal on mobile, vertical on desktop; max 5 visible */}
            {totalGaleria > 1 && (
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto pb-1 lg:pb-0 lg:w-20 shrink-0">
                {visibleThumbs.map((img, idx) => {
                  const isLastVisible = idx === MAX_VISIBLE_THUMBS - 1 && extraPhotos > 0
                  const showExtraOverlay = isLastVisible
                  return (
                    <button
                      key={img.id}
                      onClick={() => {
                        if (imagenActiva === idx) openViewer(idx)
                        else setImagenActiva(idx)
                      }}
                      aria-label={
                        showExtraOverlay
                          ? `Foto ${idx + 1} de ${totalGaleria}, ver las ${extraPhotos} fotos restantes en pantalla completa`
                          : `Ver foto ${idx + 1} de ${totalGaleria}`
                      }
                      aria-pressed={imagenActiva === idx}
                      className={`relative shrink-0 w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        imagenActiva === idx
                          ? 'border-accent'
                          : 'border-gray-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={productImagesService.resolveAltText(img, producto.titulo)}
                        className="w-full h-full object-cover"
                      />
                      {showExtraOverlay && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-[10px] sm:text-xs font-bold px-1 text-center leading-tight"
                        >
                          +{extraPhotos} fotos
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Main image with arrows */}
            <div className="relative flex-1 min-w-0">
              <div className="relative rounded-xl overflow-hidden bg-primary-light/10 border border-gray-100">
                <button
                  type="button"
                  onClick={() => openViewer(imagenActiva)}
                  aria-label="Ver imagen en pantalla completa"
                  className="block w-full cursor-zoom-in group/main"
                >
                  <img
                    src={galeriaImagenes.length > 0 ? galeriaImagenes[imagenActiva]?.url : effectiveImage || undefined}
                    alt={effectiveAlt}
                    className="w-full h-80 sm:h-96 lg:h-[460px] object-contain transition-opacity duration-200 group-hover/main:opacity-95 motion-reduce:transition-none"
                  />
                </button>

                {/* Arrows — vertically centered, inset from image edges */}
                {totalGaleria > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-primary-dark hover:bg-white transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-primary-dark hover:bg-white transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Product info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col"
          >
            {/* Category · SKU + share (top-right, secondary) */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {producto.categories && (
                  <>
                    {categorySlug ? (
                      <Link to={`/categoria/${categorySlug}`} className="text-meta">
                        {producto.categories.nombre}
                      </Link>
                    ) : (
                      <span className="text-meta">{producto.categories.nombre}</span>
                    )}
                    <span className="text-meta" aria-hidden="true">·</span>
                  </>
                )}
                <span className="text-meta">
                  SKU: {selectedVariant?.sku || producto.slug?.toUpperCase().slice(0, 20) || 'DEMO-SKU-001'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleShare}
                aria-label="Compartir producto"
                title="Compartir"
                className="ml-auto shrink-0 p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:text-primary-dark hover:bg-gray-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Title */}
            <h1 className="text-h1 text-2xl sm:text-3xl mb-4">{producto.titulo}</h1>

            {/* Brand */}
            {producto.marca && (
              <p className="text-body mb-3">
                Marca: <span className="text-primary-dark font-medium">{producto.marca}</span>
              </p>
            )}

            {/* Price */}
            <div className="mb-4">
              {effectivePriceAnterior && effectivePriceAnterior > effectivePrice && (
                <span className="text-price-strike block mb-1">
                  ${effectivePriceAnterior.toLocaleString('es-AR')}
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                Precio por transferencia
              </p>
              <p className="text-price text-3xl sm:text-4xl">
                ${effectivePrice.toLocaleString('es-AR')}
              </p>
              <p className="mt-2 text-sm font-semibold text-primary-dark">
                o en {INSTALLMENT_COUNT} cuotas de ${installmentAmount.toLocaleString('es-AR')} con Mercado Pago
              </p>
              {USDT_METHOD && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
                  <USDT_METHOD.icon className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                  También podés abonar con USDT (TRC20)
                </p>
              )}
            </div>

            {/* Free shipping — business policy, always shown */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary-light bg-primary-light/40 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Truck className="w-5 h-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary-dark">Envío gratis a todo el país</p>
                <p className="text-xs text-primary">Sin costo adicional en todas tus compras</p>
              </div>
            </div>

            {/* Stock */}
            {isVariantProduct ? (
              <p className={`text-sm mb-4 ${
                effectiveStock <= 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'
              }`}>
                {effectiveStock <= 0 ? 'Sin stock' : 'Disponible'}
              </p>
            ) : (
              <p className={`text-sm mb-4 ${
                effectiveStock <= 0 ? 'text-red-500 font-medium' :
                effectiveStock <= 5 ? 'text-amber-600' : 'text-gray-500'
              }`}>
                {effectiveStock <= 0
                  ? 'Sin stock disponible'
                  : effectiveStock <= 5
                    ? `Últimas ${effectiveStock} unidades`
                    : `${effectiveStock} unidades disponibles`}
              </p>
            )}

            {/* Selection zone — variantes + cantidad */}
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              {(showVariantSelector || variantesError) && (
                <div className="min-w-0 flex-1">
                  {showVariantSelector && (
                    <div className="space-y-3">
                      {attributeGroups.map((group) => {
                        const compatible = getCompatibleValues(variantes, group.key, selectedAttributes)
                        const optionStates = group.values.map(val => {
                          const isSelected = selectedAttributes[group.key] === val
                          const isCompatible = compatible.has(val)
                          const matchingVariant = variantes.find(v => {
                            if (!v.atributos || typeof v.atributos !== 'object') return false
                            const attrs = v.atributos as AttributeMap
                            return Object.entries({ ...selectedAttributes, [group.key]: val }).every(
                              ([k, v]) => attrs[k] === v
                            )
                          })
                          const isAvailable = matchingVariant
                            ? (variantAvail.get(matchingVariant.id) ?? 0) > 0
                            : false
                          return { val, isSelected, isCompatible, isAvailable }
                        })

                        return (
                          <VariantDropdown
                            key={group.key}
                            label={group.key}
                            options={optionStates}
                            value={selectedAttributes[group.key]}
                            onSelect={(val) => handleAttributeSelect(group.key, val)}
                          />
                        )
                      })}
                    </div>
                  )}

                  {variantesError && (
                    <p className="text-xs text-red-500 mt-3">Error al cargar variantes: {variantesError}</p>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div className="shrink-0 flex items-center gap-2">
                <span id="quantity-label" className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Cantidad
                </span>
                <div className="flex items-center border border-gray-200 rounded-lg" role="group" aria-labelledby="quantity-label">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={effectiveStock <= 0}
                    className="p-2.5 text-gray-500 hover:text-primary-dark transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Reducir cantidad"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-medium text-primary-dark">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(effectiveStock > 0 ? effectiveStock : 1, q + 1))}
                    disabled={effectiveStock <= 0}
                    className="p-2.5 text-gray-500 hover:text-primary-dark transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* CTA — última acción principal, debajo de toda la información */}
            {(() => {
              const needsVariant = hasVariants && !selectedVariant
              const anyVariantAvailable = Array.from(variantAvail.values()).some(s => s > 0)
              const outOfStock = effectiveStock <= 0
              const missingVariantBlocked = needsVariant && !anyVariantAvailable
              const isDisabled =
                !producto.activo || cartLoading || missingVariantBlocked ||
                (!needsVariant && outOfStock)

              let label = 'Agregar al carrito'
              if (cartLoading) label = 'Agregando...'
              else if (needsVariant) label = anyVariantAvailable || variantesLoading ? 'Seleccioná una variante' : 'Sin stock'
              else if (outOfStock) label = 'Sin stock'

              return (
                <button
                  onClick={handleAddToCart}
                  disabled={isDisabled}
                  className="btn-primary w-full"
                >
                  <ShoppingCart className="w-6 h-6" />
                  {label}
                </button>
              )
            })()}

          </motion.div>
        </div>

        {/* ── Description section ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-12 sm:mt-16"
        >
          <h2 className="text-h2 text-xl sm:text-2xl mb-4">Descripción</h2>
          <div className="border-t border-gray-100 pt-6">
            {producto.descripcion ? (
              <p className="text-body leading-relaxed max-w-3xl">{producto.descripcion}</p>
            ) : (
              <p className="text-body text-gray-400 italic">
                Este producto aún no tiene descripción disponible.
              </p>
            )}
          </div>
        </motion.section>

        {/* ── Specifications section ── */}
        {specs.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 sm:mt-16"
          >
            <h2 className="text-h2 text-xl sm:text-2xl mb-4">Especificaciones técnicas</h2>
            <div className="border-t border-gray-100 pt-6">
              <div className="bg-gray-50 rounded-xl overflow-hidden max-w-2xl">
                <table className="w-full text-sm">
                  <tbody>
                    {specs.map((spec) => (
                      <tr key={spec.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-500 w-1/3">{spec.name}</td>
                        <td className="px-4 py-3 text-primary-dark">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── Reviews section (demo) ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-12 sm:mt-16"
        >
          <h2 className="text-h2 text-xl sm:text-2xl mb-4">Reseñas y calificaciones</h2>
          <div className="border-t border-gray-100 pt-6">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Demostración</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-8 max-w-3xl">
              {/* Rating summary */}
              <div className="text-center sm:text-left">
                <p className="text-5xl font-black text-primary-dark mb-1">4,8</p>
                <div className="flex items-center justify-center sm:justify-start gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-5 h-5 ${s <= 4 ? 'fill-amber-400 text-amber-400' : 'fill-amber-200 text-amber-200'}`} />
                  ))}
                </div>
                <p className="text-body text-xs">Basado en datos de ejemplo</p>
              </div>

              {/* Demo reviews */}
              <div className="space-y-4">
                {[
                  { name: 'Ejemplo 1', text: 'Excelente producto, muy conforme con la compra. Esta es una reseña de demostración.' },
                  { name: 'Ejemplo 2', text: 'Buena calidad y envío rápido. Opinión ilustrativa, no real.' },
                ].map((r, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary-light/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-dark">{r.name.charAt(0)}</span>
                      </div>
                      <span className="text-sm font-medium text-primary-dark">{r.name}</span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= 4 ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} />
                      ))}
                    </div>
                    <p className="text-body text-sm">{r.text}</p>
                  </div>
                ))}
                <p className="text-xs text-gray-400 italic flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Contenido ilustrativo, no opiniones reales de clientes.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Related products */}
        {related.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 sm:mt-20"
          >
            <h2 className="text-h2 text-2xl sm:text-3xl mb-8">Productos relacionados</h2>
            <ProductGrid variant="full">
              {related.map((prod) => (
                <motion.div
                  key={prod.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                >
                  <ProductCard product={prod} />
                </motion.div>
              ))}
            </ProductGrid>
          </motion.section>
        )}
      </div>

      {viewerOpen && viewerImages.length > 0 && (
        <ProductImageViewer
          images={viewerImages}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  )
}
