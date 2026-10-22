import { useEffect, useRef } from 'react'

interface SelectionCheckboxProps {
  checked: boolean
  /** Cabecera con parte de las filas marcadas */
  indeterminate?: boolean
  /** shiftKey: Shift+click (selección por rango en escritorio) */
  onToggle: (shiftKey: boolean) => void
  /** Nombre accesible, por ejemplo "Seleccionar <producto>" */
  label: string
  disabled?: boolean
  className?: string
}

/** Checkbox de selección de filas: área clicable de 44px, foco visible y estado indeterminado */
export default function SelectionCheckbox({
  checked,
  indeterminate = false,
  onToggle,
  label,
  disabled = false,
  className = '',
}: SelectionCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])

  return (
    <label className={`inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${className}`}>
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        // En un checkbox el evento nativo del cambio es el click: trae shiftKey
        onChange={e => onToggle((e.nativeEvent as MouseEvent).shiftKey === true)}
        className="w-4 h-4 rounded cursor-pointer accent-[#185749] dark:accent-[#1CAAA8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#185749] dark:focus-visible:outline-[#1CAAA8] disabled:cursor-not-allowed"
      />
    </label>
  )
}
