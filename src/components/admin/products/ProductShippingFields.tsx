import type { UseFormReturn } from 'react-hook-form'

interface ProductShippingFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
}

export default function ProductShippingFields({ form }: ProductShippingFieldsProps) {
  const {
    register,
    formState: { errors },
  } = form

  const fields = [
    { name: 'peso_envio_gramos' as const, label: 'Peso (gramos)', max: 25000, placeholder: 'ej: 500' },
    { name: 'alto_paquete_cm' as const, label: 'Alto (cm)', max: 150, placeholder: 'ej: 30' },
    { name: 'ancho_paquete_cm' as const, label: 'Ancho (cm)', max: 150, placeholder: 'ej: 40' },
    { name: 'largo_paquete_cm' as const, label: 'Largo (cm)', max: 150, placeholder: 'ej: 50' },
  ]

  const getError = (name: string): { message?: string } | undefined => {
    const e = errors[name]
    if (e && typeof e === 'object' && 'message' in e) return e as { message?: string }
    return undefined
  }

  const logisticsError = getError('peso_envio_gramos')
  const isLogisticsCustomError = logisticsError?.message &&
    !logisticsError.message.includes('debe ser un número')

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70 mb-1">Datos de envio</h3>
      <p className="text-xs text-gray-400 dark:text-white/25 mb-4">
        Dimensiones y peso del paquete listo para envio. Completar todos o dejar todos vacios.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {fields.map((field) => {
          const fieldError = getError(field.name)
          return (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                {field.label}
              </label>
              <input
                id={field.name}
                type="number"
                step="1"
                min="1"
                max={field.max}
                {...register(field.name)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
                placeholder={field.placeholder}
              />
              {fieldError && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{fieldError.message}</p>
              )}
            </div>
          )
        })}
      </div>

      {isLogisticsCustomError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{logisticsError!.message}</p>
      )}
    </div>
  )
}
