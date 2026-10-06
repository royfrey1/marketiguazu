import { Link } from 'react-router-dom'

interface TermsAcceptanceProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Mostrar el error inline (se intentó avanzar sin aceptar). */
  showError: boolean
}

const LINK_CLASS = 'font-semibold text-accent hover:underline'

/** Checkbox obligatorio de aceptación de Términos y Política de Privacidad (checkout y registro). */
export default function TermsAcceptance({ id, checked, onChange, showError }: TermsAcceptanceProps) {
  const errorId = `${id}-error`

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className="mt-0.5 w-4 h-4 shrink-0 accent-accent cursor-pointer"
        />
        <label htmlFor={id} className="text-sm text-gray-600 leading-snug cursor-pointer">
          Leí y acepto los{' '}
          <Link to="/terminos" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            Términos y Condiciones
          </Link>{' '}
          y la{' '}
          <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            Política de Privacidad
          </Link>
        </label>
      </div>
      {showError && (
        <p id={errorId} role="alert" className="mt-1.5 ml-6.5 text-xs font-medium text-red-600">
          Para continuar tenés que aceptar los Términos y la Política de Privacidad
        </p>
      )}
    </div>
  )
}
