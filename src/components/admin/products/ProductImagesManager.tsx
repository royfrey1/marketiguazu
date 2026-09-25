import { useState, useEffect, useRef } from 'react'
import { Upload, Star, Trash2, ArrowUp, ArrowDown, Loader2, ImageIcon } from 'lucide-react'
import useAuth from '../../../hooks/useAuth'
import {
  productImagesService,
  type ProductImage,
} from '../../../services/productImages.service'

interface ProductImagesManagerProps {
  productId: number
}

export default function ProductImagesManager({ productId }: ProductImagesManagerProps) {
  const { user } = useAuth()
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingAltId, setEditingAltId] = useState<number | null>(null)
  const [altValue, setAltValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await productImagesService.getByProductId(productId)
      if (!cancelled) {
        if (error) {
          setError(error.message)
        } else {
          setImages(data ?? [])
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [productId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !user?.id) return

    setUploading(true)
    setError(null)

    const fileArray = Array.from(files)
    const errors: string[] = []

    for (const file of fileArray) {
      const { data, error } = await productImagesService.upload(productId, file, user.id)
      if (error) {
        errors.push(`${file.name}: ${error.message}`)
      } else if (data) {
        setImages((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order))
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (image: ProductImage) => {
    setDeletingId(image.id)
    setError(null)

    const { error } = await productImagesService.remove(image)
    if (error) {
      setError(error.message)
    } else {
      setImages((prev) => {
        const filtered = prev.filter((img) => img.id !== image.id)
        if (image.es_principal && filtered.length > 0) {
          const sorted = [...filtered].sort((a, b) => a.sort_order - b.sort_order)
          sorted[0] = { ...sorted[0], es_principal: true }
          return sorted
        }
        return filtered
      })
    }

    setDeletingId(null)
  }

  const handleSetPrincipal = async (image: ProductImage) => {
    setError(null)
    const { error } = await productImagesService.setPrincipal(image.id, productId)
    if (error) {
      setError(error.message)
    } else {
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          es_principal: img.id === image.id,
        }))
      )
    }
  }

  const handleMoveUp = async (image: ProductImage, index: number) => {
    if (index === 0) return
    const prev = images[index - 1]
    const updates = [
      { id: image.id, sort_order: prev.sort_order },
      { id: prev.id, sort_order: image.sort_order },
    ]
    const { error } = await productImagesService.reorder(updates)
    if (!error) {
      setImages((prevImages) => {
        const sorted = [...prevImages]
        ;[sorted[index - 1], sorted[index]] = [sorted[index], sorted[index - 1]]
        return sorted
      })
    }
  }

  const handleMoveDown = async (image: ProductImage, index: number) => {
    if (index >= images.length - 1) return
    const next = images[index + 1]
    const updates = [
      { id: image.id, sort_order: next.sort_order },
      { id: next.id, sort_order: image.sort_order },
    ]
    const { error } = await productImagesService.reorder(updates)
    if (!error) {
      setImages((prevImages) => {
        const sorted = [...prevImages]
        ;[sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]]
        return sorted
      })
    }
  }

  const handleSaveAlt = async (imageId: number) => {
    const { error } = await productImagesService.updateAltText(imageId, altValue)
    if (!error) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, alt_text: altValue || null } : img
        )
      )
    }
    setEditingAltId(null)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
          Imagenes
        </h3>
        <p className="text-gray-400 animate-pulse text-sm">Cargando imagenes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Imagenes ({images.length})
        </h3>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#185749] bg-[#185749]/5 hover:bg-[#185749]/10 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700 whitespace-pre-line">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-700 mt-1 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {images.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin imagenes</p>
          <p className="text-xs text-gray-400 mt-1">Subi imagenes del producto</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`relative group rounded-lg border-2 overflow-hidden transition-colors ${
                image.es_principal
                  ? 'border-[#185749] ring-1 ring-[#185749]/20'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              {image.es_principal && (
                <span className="absolute top-1.5 left-1.5 z-10 bg-[#185749] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                  Principal
                </span>
              )}

              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={image.url}
                  alt={image.alt_text || ''}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleMoveUp(image, index)}
                      disabled={index === 0}
                      className="p-1 text-white/80 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Mover arriba"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(image, index)}
                      disabled={index === images.length - 1}
                      className="p-1 text-white/80 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Mover abajo"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    {!image.es_principal && (
                      <button
                        onClick={() => handleSetPrincipal(image)}
                        className="p-1 text-white/80 hover:text-amber-300 cursor-pointer"
                        title="Hacer principal"
                      >
                        <Star className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(image)}
                    disabled={deletingId === image.id}
                    className="p-1 text-white/80 hover:text-red-400 disabled:opacity-50 cursor-pointer"
                    title="Eliminar"
                  >
                    {deletingId === image.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-2">
                {editingAltId === image.id ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={altValue}
                      onChange={(e) => setAltValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAlt(image.id)
                        if (e.key === 'Escape') setEditingAltId(null)
                      }}
                      className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#185749]"
                      placeholder="Alt text"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveAlt(image.id)}
                      className="text-[10px] text-[#185749] hover:underline cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingAltId(image.id)
                      setAltValue(image.alt_text || '')
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 truncate w-full text-left cursor-pointer"
                    title={image.alt_text || 'Agregar alt text'}
                  >
                    {image.alt_text || '+ alt text'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
