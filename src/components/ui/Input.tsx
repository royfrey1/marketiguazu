import { forwardRef, type InputHTMLAttributes } from 'react'
import PasswordInput from './PasswordInput'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  /** Contraseña con botón para ver / ocultar */
  revealable?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, revealable = false, id, className = '', ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const errorId = inputId ? `${inputId}-error` : undefined
    const helperId = inputId ? `${inputId}-helper` : undefined
    const inputProps = {
      ref,
      id: inputId,
      'aria-invalid': !!error,
      'aria-describedby': error ? errorId : helperText ? helperId : undefined,
      className: `
            w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all
            ${
              error
                ? 'border-red-400 focus:border-red-500 bg-red-50/30'
                : 'border-gray-200 focus:border-accent bg-white'
            }
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${className}
          `.trim(),
      ...props,
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-bold text-gray-800 uppercase"
          >
            {label}
          </label>
        )}

        {revealable ? <PasswordInput {...inputProps} /> : <input {...inputProps} />}

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

Input.displayName = 'Input'

export default Input
