import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Info } from 'lucide-react'
import type { Category } from '../../../services/categories.service'
import OfferPricePreview from '../offers/OfferPricePreview'
import { formatArs } from '../../../lib/offers'

interface ProductBasicFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
  categories: Category[]
  isEditing: boolean
  slugExists: boolean | null
  onSlugCheck: (slug: string) => void
  /** Con variantes activas la oferta se define en cada variante: el casillero del producto no aplica */
  hasActiveVariants?: boolean
  /** El producto tenía en_oferta = true a nivel producto (ya no cuenta si tiene variantes) */
  legacyProductOffer?: boolean
}

const toNumber = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export default function ProductBasicFields({
  form,
  categories,
  isEditing,
  slugExists,
  onSlugCheck,
  hasActiveVariants = false,
  legacyProductOffer = false,
}: ProductBasicFieldsProps) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
    control,
  } = form

  const slugValue = watch('slug')
  const enOferta = !!watch('en_oferta')
  const precioValue = toNumber(watch('precio'))
  const precioAnteriorValue = toNumber(watch('precio_anterior'))
  const opcionBaseNombre = String(watch('opcion_base_nombre') ?? '')

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    register('titulo').onChange(e)

    if (!isEditing) {
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setValue('slug', slug, { shouldValidate: true })
    }
  }

  const handleSlugBlur = () => {
    if (slugValue) {
      onSlugCheck(slugValue)
    }
  }

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70 mb-4">Información del producto</h3>

      <div className="space-y-4">
        {/* Titulo */}
        <div>
          <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
            Titulo <span className="text-red-500">*</span>
          </label>
          <input
            id="titulo"
            type="text"
            {...register('titulo')}
            onChange={handleTitleChange}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
            placeholder="Nombre del producto"
          />
          {errors.titulo && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{(errors.titulo as { message?: string }).message}</p>
          )}
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            id="slug"
            type="text"
            {...register('slug')}
            onBlur={handleSlugBlur}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors font-mono"
            placeholder="nombre-del-producto"
          />
          {errors.slug && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{(errors.slug as { message?: string }).message}</p>
          )}
          {slugExists === true && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">Ya existe un producto con ese slug</p>
          )}
        </div>

        {/* Descripcion */}
        <div>
          <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
            Descripcion
          </label>
          <textarea
            id="descripcion"
            {...register('descripcion')}
            rows={4}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors resize-y"
            placeholder="Descripción del producto (opcional)"
          />
          {errors.descripcion && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{(errors.descripcion as { message?: string }).message}</p>
          )}
        </div>

        {/* Marca */}
        <div>
          <label htmlFor="marca" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
            Marca
          </label>
          <input
            id="marca"
            type="text"
            {...register('marca')}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
            placeholder="Marca del producto (opcional)"
          />
          {errors.marca && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{(errors.marca as { message?: string }).message}</p>
          )}
        </div>

        {/* Categoria */}
        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
            Categoria <span className="text-red-500">*</span>
          </label>
          <Controller
            name="category_id"
            control={control}
            render={({ field }) => (
              <select
                id="category_id"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                onBlur={field.onBlur}
                ref={field.ref}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors cursor-pointer"
              >
                <option value="">Seleccionar categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icono ? `${cat.icono} ` : ''}{cat.nombre}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.category_id && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{(errors.category_id as { message?: string }).message}</p>
          )}
        </div>

        {/* Precio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="precio" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
              Precio <span className="text-red-500">*</span>
            </label>
            <input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              {...register('precio')}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
              placeholder="0"
            />
            {errors.precio && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{(errors.precio as { message?: string }).message}</p>
            )}
          </div>
          <div>
            <label htmlFor="precio_anterior" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
              Precio anterior {enOferta && !hasActiveVariants && <span className="text-red-500">*</span>}
            </label>
            <input
              id="precio_anterior"
              type="number"
              step="0.01"
              min="0"
              {...register('precio_anterior')}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
              placeholder="Opcional"
            />
            {errors.precio_anterior && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{(errors.precio_anterior as { message?: string }).message}</p>
            )}
          </div>
        </div>

        {/* Oferta */}
        <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4 space-y-3">
          {hasActiveVariants ? (
            <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-white/60">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#185749] dark:text-[#1CAAA8]" aria-hidden="true" />
              <span>
                Este producto tiene variantes: marcá la oferta en cada variante.
                {legacyProductOffer && (
                  <span className="block mt-1 text-amber-700 dark:text-amber-400">
                    Estaba marcado en oferta como producto, pero ya no se muestra así porque tiene variantes. Al guardar se desmarca.
                  </span>
                )}
              </span>
            </p>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <input
                  id="en_oferta"
                  type="checkbox"
                  {...register('en_oferta')}
                  className="mt-0.5 rounded border-gray-300 dark:border-white/20 cursor-pointer"
                />
                <div>
                  <label htmlFor="en_oferta" className="text-sm font-medium text-gray-700 dark:text-white/70 cursor-pointer">
                    Mostrar en Ofertas
                  </label>
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                    El precio anterior es el precio normal vigente antes de la oferta y tiene que ser un precio real de venta.
                  </p>
                </div>
              </div>
              {/* El error en vivo se oculta cuando zod ya lo muestra en el campo, para no duplicarlo */}
              {enOferta && <OfferPricePreview precio={precioValue} precioAnterior={precioAnteriorValue} showError={!errors.precio_anterior} />}
              {!isEditing && (
                <p className="text-xs text-gray-400 dark:text-white/30">
                  Si luego agregás variantes, la oferta se define en cada variante.
                </p>
              )}
            </>
          )}
        </div>

        {/* Opción base: solo al editar un producto con variantes activas (en el alta todavía no hay variantes) */}
        {isEditing && hasActiveVariants && (
          <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4 space-y-2">
            <label htmlFor="opcion_base_nombre" className="block text-sm font-medium text-gray-700 dark:text-white/70">
              Nombre de la opción base
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <input
                id="opcion_base_nombre"
                type="text"
                maxLength={60}
                {...register('opcion_base_nombre')}
                aria-describedby="opcion_base_nombre-ayuda opcion_base_nombre-precio"
                className="w-full sm:flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
                placeholder="Ej.: Gris acero (vacío = no se ofrece)"
              />
              <p id="opcion_base_nombre-precio" className="shrink-0 text-sm text-gray-600 dark:text-white/60">
                Precio de la opción:{' '}
                <span className="font-semibold text-gray-800 dark:text-white/80">
                  {precioValue !== null && precioValue > 0 ? formatArs(precioValue) : '—'}
                </span>
              </p>
            </div>
            {errors.opcion_base_nombre && (
              <p className="text-sm text-red-600 dark:text-red-400">{(errors.opcion_base_nombre as { message?: string }).message}</p>
            )}
            {opcionBaseNombre.trim() !== '' && (precioValue === null || precioValue <= 0) && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                El precio del producto está vacío o en 0: la opción base se ofrecería con ese precio.
              </p>
            )}
            <p id="opcion_base_nombre-ayuda" className="text-xs text-gray-500 dark:text-white/40">
              Ofrece el producto base como una opción más, junto a las variantes. Usa el precio del producto y el stock
              que cargues en Inventario para el producto base (sin variante). No entra en ofertas. Dejalo vacío para no ofrecerla.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
