import { useState, useEffect, useRef } from 'react'
import { Upload, Star, Trash2, Loader2, ImageIcon } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useAuth from '../../../hooks/useAuth'
import Modal from '../../ui/Modal'
import {
  productImagesService,
  type ProductImage,
} from '../../../services/productImages.service'

interface ProductImagesManagerProps {
  productId: number
  /** Si se pasa, gestiona la galería propia de esa variante (vista compacta, para usar dentro de un modal). */
  variantId?: number
}

function loadGallery(productId: number, variantId?: number) {
  return variantId != null
    ? productImagesService.getByVariantId(variantId)
    : productImagesService.getByProductId(productId)
}

interface SortableImageCardProps {
  image: ProductImage
  deleting: boolean
  onSetPrincipal: (image: ProductImage) => void
  onRequestDelete: (image: ProductImage) => void
  onSaveAlt: (imageId: number, altText: string) => void
}

function SortableImageCard({
  image,
  deleting,
  onSetPrincipal,
  onRequestDelete,
  onSaveAlt,
}: SortableImageCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id })
  const [editingAlt, setEditingAlt] = useState(false)
  const [altValue, setAltValue] = useState('')

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : undefined,
    zIndex: isDragging ? 20 : undefined,
  }

  const saveAlt = () => {
    onSaveAlt(image.id, altValue)
    setEditingAlt(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
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

      {/* Handle de drag: solo la zona de la foto */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="aspect-square bg-gray-100 overflow-hidden cursor-grab active:cursor-grabbing touch-none"
      >
        <img
          src={image.url}
          alt={image.alt_text || ''}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity ${
          isDragging ? 'hidden' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5">
            {!image.es_principal && (
              <button
                type="button"
                onClick={() => onSetPrincipal(image)}
                className="p-1 text-white/80 hover:text-amber-300 cursor-pointer"
                title="Hacer principal"
              >
                <Star className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRequestDelete(image)}
            disabled={deleting}
            className="p-1 text-white/80 hover:text-red-400 disabled:opacity-50 cursor-pointer"
            title="Eliminar"
          >
            {deleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      <div className="p-2">
        {editingAlt ? (
          <div className="flex gap-1">
            <input
              type="text"
              value={altValue}
              onChange={(e) => setAltValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveAlt()
                if (e.key === 'Escape') setEditingAlt(false)
              }}
              className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#185749]"
              placeholder="Alt text"
              autoFocus
            />
            <button
              type="button"
              onClick={saveAlt}
              className="text-[10px] text-[#185749] hover:underline cursor-pointer"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setEditingAlt(false)}
              className="text-[10px] text-gray-400 hover:underline cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingAlt(true)
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
  )
}

export default function ProductImagesManager({ productId, variantId }: ProductImagesManagerProps) {
  const isVariantGallery = variantId != null
  const title = isVariantGallery ? 'Fotos de esta variante' : 'Imagenes'
  const { user } = useAuth()
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductImage | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const [rememberChecked, setRememberChecked] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await loadGallery(productId, variantId)
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
  }, [productId, variantId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !user?.id) return

    setUploading(true)
    setError(null)

    const fileArray = Array.from(files)
    const errors: string[] = []

    for (const file of fileArray) {
      const { data, error } = await productImagesService.upload(productId, file, user.id, undefined, variantId)
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

  const runDelete = async (image: ProductImage) => {
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

  const handleRequestDelete = (image: ProductImage) => {
    if (dontAskAgain) {
      void runDelete(image)
    } else {
      setRememberChecked(dontAskAgain)
      setDeleteTarget(image)
    }
  }

  const handleConfirmDelete = () => {
    const target = deleteTarget
    setDontAskAgain(rememberChecked)
    setDeleteTarget(null)
    if (target) void runDelete(target)
  }

  const handleSetPrincipal = async (image: ProductImage) => {
    setError(null)
    const { error } = await productImagesService.setPrincipal(image.id, productId, variantId)
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

  const handleSaveAlt = async (imageId: number, altText: string) => {
    const { error } = await productImagesService.updateAltText(imageId, altText)
    if (!error) {
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, alt_text: altText || null } : img))
      )
    }
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = images.findIndex((img) => img.id === active.id)
    const newIndex = images.findIndex((img) => img.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(images, oldIndex, newIndex)
    setImages(reordered)

    const { error } = await productImagesService.reorder(
      productId,
      reordered.map((img) => img.id),
      variantId
    )
    if (error) {
      setError(`No se pudo guardar el orden: ${error.message}`)
      const { data } = await loadGallery(productId, variantId)
      if (data) setImages(data)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
          {title}
        </h3>
        <p className="text-gray-400 animate-pulse text-sm">Cargando imagenes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title} ({images.length})
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
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:underline mt-1 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {images.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin imagenes</p>
          <p className="text-xs text-gray-400 mt-1">
            {isVariantGallery ? 'Subí fotos de esta variante' : 'Subi imagenes del producto'}
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
            <div className={isVariantGallery ? 'grid grid-cols-3 sm:grid-cols-4 gap-2' : 'grid grid-cols-2 sm:grid-cols-3 gap-3'}>
              {images.map((image) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  deleting={deletingId === image.id}
                  onSetPrincipal={handleSetPrincipal}
                  onRequestDelete={handleRequestDelete}
                  onSaveAlt={handleSaveAlt}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Escape no debe propagarse: dentro de otro Modal cerraría también el externo */}
      <div onKeyDown={(e) => e.stopPropagation()}>
        <Modal
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          title="Eliminar imagen"
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          }
        >
          <p className="text-sm text-gray-700 dark:text-white/70">
            ¿Seguro que querés eliminar esta imagen?
          </p>
          <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberChecked}
              onChange={(e) => setRememberChecked(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-xs text-gray-500 dark:text-white/50">
              No volver a preguntar en esta sesión de edición
            </span>
          </label>
        </Modal>
      </div>
    </div>
  )
}
