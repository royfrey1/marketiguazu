import { Plus, Trash2, ChevronUp, ChevronDown, Settings } from 'lucide-react'

export interface SpecItem {
  name: string
  value: string
}

interface ProductSpecificationsEditorProps {
  value: SpecItem[]
  onChange: (items: SpecItem[]) => void
  disabled?: boolean
  errors?: { index: number; field: 'name' | 'value'; message: string }[]
}

export default function ProductSpecificationsEditor({
  value,
  onChange,
  disabled = false,
  errors = [],
}: ProductSpecificationsEditorProps) {
  const addItem = () => {
    onChange([...value, { name: '', value: '' }])
  }

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: 'name' | 'value', newValue: string) => {
    const next = value.map((item, i) =>
      i === index ? { ...item, [field]: newValue } : item
    )
    onChange(next)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...value]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  const moveDown = (index: number) => {
    if (index === value.length - 1) return
    const next = [...value]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  const getError = (index: number, field: 'name' | 'value'): string | undefined =>
    errors.find(e => e.index === index && e.field === field)?.message

  const inputClasses = (hasError: boolean) =>
    `w-full px-2.5 py-1.5 text-sm border rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors disabled:opacity-50 ${
      hasError
        ? 'border-red-400 dark:border-red-600'
        : 'border-gray-200 dark:border-white/10'
    }`

  return (
    <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 mb-0.5">
          <Settings className="w-4 h-4 text-gray-400 dark:text-white/30" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70">Especificaciones técnicas</h3>
        </div>
        <p className="text-xs text-gray-400 dark:text-white/25">
          Características opcionales del producto. Se mostrarán en el detalle.
        </p>
      </div>

      {/* Table header — only when rows exist */}
      {value.length > 0 && (
        <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_80px] gap-2 px-5 py-2 border-b border-gray-100 dark:border-white/5 text-[11px] font-medium text-gray-400 dark:text-white/25 uppercase tracking-wider">
          <span>Nombre</span>
          <span>Valor</span>
          <span className="text-center">Acciones</span>
        </div>
      )}

      {/* Rows */}
      {value.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {value.map((item, index) => {
            const nameError = getError(index, 'name')
            const valueError = getError(index, 'value')

            return (
              <div
                key={index}
                className="px-5 py-2.5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
              >
                {/* Desktop: table row */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_80px] gap-2 sm:items-center">
                  <div>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="Ej. Resolución"
                      disabled={disabled}
                      aria-label={`Nombre de especificación ${index + 1}`}
                      className={inputClasses(!!nameError)}
                    />
                    {nameError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{nameError}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => updateItem(index, 'value', e.target.value)}
                      placeholder="Ej. 2560 × 1440"
                      disabled={disabled}
                      aria-label={`Valor de especificación ${index + 1}`}
                      className={inputClasses(!!valueError)}
                    />
                    {valueError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{valueError}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={disabled || index === 0}
                      aria-label="Subir especificación"
                      className="p-1 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={disabled || index === value.length - 1}
                      aria-label="Bajar especificación"
                      className="p-1 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={disabled}
                      aria-label="Eliminar especificación"
                      className="p-1 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mobile: stacked */}
                <div className="sm:hidden space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 dark:text-white/25 mb-1 uppercase tracking-wider">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="Ej. Resolución"
                      disabled={disabled}
                      aria-label={`Nombre de especificación ${index + 1}`}
                      className={inputClasses(!!nameError)}
                    />
                    {nameError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{nameError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 dark:text-white/25 mb-1 uppercase tracking-wider">
                      Valor
                    </label>
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => updateItem(index, 'value', e.target.value)}
                      placeholder="Ej. 2560 × 1440"
                      disabled={disabled}
                      aria-label={`Valor de especificación ${index + 1}`}
                      className={inputClasses(!!valueError)}
                    />
                    {valueError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{valueError}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={disabled || index === 0}
                      aria-label="Subir especificación"
                      className="p-1.5 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={disabled || index === value.length - 1}
                      aria-label="Bajar especificación"
                      className="p-1.5 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={disabled}
                      aria-label="Eliminar especificación"
                      className="p-1.5 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {value.length === 0 && (
        <div className="px-5 py-6 flex flex-col items-center justify-center">
          <Settings className="w-7 h-7 text-gray-200 dark:text-white/10 mb-2" />
          <p className="text-sm text-gray-500 dark:text-white/40 text-center">
            Aún no agregaste especificaciones
          </p>
        </div>
      )}

      {/* Add button */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-white/5">
        <button
          type="button"
          onClick={addItem}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#185749] dark:text-[#1CAAA8] hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 border border-dashed border-[#185749]/30 dark:border-[#1CAAA8]/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Agregar especificación
        </button>
      </div>
    </div>
  )
}
