import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { categorySchema, type CategoryFormData } from '../../../lib/validations/category'
import type { Category } from '../../../services/categories.service'

interface CategoryFormProps {
  category?: Category | null
  parentCategories: Category[]
  excludedIds?: number[]
  onSubmit: (data: CategoryFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function CategoryForm({
  category,
  parentCategories,
  excludedIds = [],
  onSubmit,
  onCancel,
  loading = false,
}: CategoryFormProps) {
  const isEditing = !!category

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      nombre: category?.nombre ?? '',
      slug: category?.slug ?? '',
      icono: category?.icono ?? '',
      parent_id: category?.parent_id ?? null,
      activo: category?.activo ?? true,
      sort_order: category?.sort_order ?? 0,
    },
  })

  const nombreValue = watch('nombre')

  useEffect(() => {
    if (!isEditing && nombreValue) {
      const slug = nombreValue
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setValue('slug', slug, { shouldValidate: true })
    }
  }, [nombreValue, isEditing, setValue])

  const availableParents = parentCategories.filter((c) => {
    if (isEditing && category) {
      if (c.id === category.id) return false
      if (excludedIds.includes(c.id)) return false
    }
    return true
  })

  const inputClasses = "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
          Nombre *
        </label>
        <input
          id="nombre"
          type="text"
          {...register('nombre')}
          className={inputClasses}
          placeholder="Nombre de la categoría"
        />
        {errors.nombre && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nombre.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
          Slug *
        </label>
        <input
          id="slug"
          type="text"
          {...register('slug')}
          className={`${inputClasses} font-mono`}
          placeholder="slug-de-la-categoria"
        />
        {errors.slug && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.slug.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="icono" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
          Icono (emoji)
        </label>
        <input
          id="icono"
          type="text"
          {...register('icono')}
          className={inputClasses}
          placeholder="📦"
          maxLength={10}
        />
        {errors.icono && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.icono.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="parent_id" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
          Categoría padre
        </label>
        <Controller
          name="parent_id"
          control={control}
          render={({ field }) => (
            <select
              id="parent_id"
              value={field.value ?? ''}
              onChange={(e) => {
                const val = e.target.value
                field.onChange(val === '' ? null : Number(val))
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              className={`${inputClasses} cursor-pointer`}
            >
              <option value="">Sin categoría padre (raíz)</option>
              {availableParents.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icono ? `${cat.icono} ` : ''}{cat.nombre}
                </option>
              ))}
            </select>
          )}
        />
        {errors.parent_id && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.parent_id.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
            Orden
          </label>
          <input
            id="sort_order"
            type="number"
            min={0}
            {...register('sort_order', { valueAsNumber: true })}
            className={inputClasses}
          />
          {errors.sort_order && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sort_order.message}</p>
          )}
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('activo')}
              className="w-4 h-4 text-[#185749] dark:text-[#1CAAA8] border-gray-300 dark:border-white/10 rounded focus:ring-[#185749] dark:focus:ring-[#1CAAA8] bg-transparent"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-white/70">Activa</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-white/60 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear categoría'}
        </button>
      </div>
    </form>
  )
}
