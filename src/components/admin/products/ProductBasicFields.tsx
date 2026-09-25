import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import type { Category } from '../../../services/categories.service'

interface ProductBasicFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
  categories: Category[]
  isEditing: boolean
  slugExists: boolean | null
  onSlugCheck: (slug: string) => void
}

export default function ProductBasicFields({
  form,
  categories,
  isEditing,
  slugExists,
  onSlugCheck,
}: ProductBasicFieldsProps) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
    control,
  } = form

  const slugValue = watch('slug')

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
              Precio anterior
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
      </div>
    </div>
  )
}
