import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Input de contraseña con botón para ver / ocultar. Recibe las mismas props (y ref) que un <input>,
 * con sus propias clases: solo suma el padding derecho para el botón.
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    // Un campo deshabilitado vuelve a quedar oculto (y el botón, deshabilitado)
    if (props.disabled && visible) setVisible(false)
    const shown = visible && !props.disabled
    const inputRef = useRef<HTMLInputElement | null>(null)
    // Selección a restaurar después del cambio de type, si el foco estaba en el input
    const selectionRef = useRef<[number | null, number | null] | null>(null)

    const setRefs = useCallback((node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }, [ref])

    // Al enviar el formulario vuelve a quedar oculta
    useEffect(() => {
      const form = inputRef.current?.form
      if (!form) return
      const hide = () => setVisible(false)
      form.addEventListener('submit', hide)
      return () => form.removeEventListener('submit', hide)
    }, [])

    useLayoutEffect(() => {
      const input = inputRef.current
      const selection = selectionRef.current
      selectionRef.current = null
      if (input && selection && document.activeElement === input) {
        input.setSelectionRange(selection[0], selection[1])
      }
    }, [shown])

    const toggle = () => {
      const input = inputRef.current
      if (input && document.activeElement === input) {
        selectionRef.current = [input.selectionStart, input.selectionEnd]
      }
      setVisible(!shown)
    }

    return (
      <div className="relative">
        <input
          {...props}
          ref={setRefs}
          // Después del spread: un type="password" que venga en las props no pisa el estado
          type={shown ? 'text' : 'password'}
          data-password-input
          className={`${className} pr-12`}
        />
        <button
          type="button"
          onClick={toggle}
          // Con el mouse, el foco se queda en el input (y el cursor donde estaba)
          onMouseDown={e => e.preventDefault()}
          disabled={props.disabled}
          aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={shown}
          aria-controls={props.id}
          className="absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70 transition-colors motion-reduce:transition-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-gray-400 dark:disabled:hover:text-white/40 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent"
        >
          {shown ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'

export default PasswordInput
