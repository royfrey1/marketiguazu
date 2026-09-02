import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, helperText, options, placeholder, id, className = '', ...props },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const errorId = selectId ? `${selectId}-error` : undefined
    const helperId = selectId ? `${selectId}-helper` : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-bold text-gray-800 uppercase"
          >
            {label}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={`
            w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all appearance-none cursor-pointer
            ${
              error
                ? 'border-red-400 focus:border-red-500 bg-red-50/30'
                : 'border-gray-200 focus:border-[#1CAAA8] bg-white'
            }
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${className}
          `.trim()}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {error && (
          <p id={errorId} className="text-red-600 text-xs font-medium" role="alert">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-gray-400 text-xs">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
