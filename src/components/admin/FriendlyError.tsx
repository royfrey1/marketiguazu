import { useId, useState } from 'react'

export const GENERIC_ERROR_MESSAGE = 'No se pudo completar la operación. Probá de nuevo; si sigue pasando, avisanos.'

/** Error con clave conocida (ProductAdminError y similares). key 'UNKNOWN' o sin key = inesperado */
export interface KeyedError {
  key?: string
  message: string
  code?: string | null
  /** Texto técnico para el detalle plegable (también en errores conocidos). Sin esto, el inesperado usa message */
  detail?: string
}

const isUnexpectedError = (error: KeyedError) => !error.key || error.key === 'UNKNOWN'

/**
 * Mensaje de error para el admin: los errores conocidos muestran su texto; los inesperados, un mensaje
 * genérico y el texto original en un detalle técnico plegable.
 */
export default function FriendlyError({ error, prefix }: { error: KeyedError; prefix?: string }) {
  const [open, setOpen] = useState(false)
  const detailId = useId()

  const unexpected = isUnexpectedError(error)
  if (!unexpected && !error.detail) {
    return <>{prefix}{error.message}</>
  }

  return (
    <>
      {prefix}{unexpected ? GENERIC_ERROR_MESSAGE : error.message}{' '}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={detailId}
        className="inline-flex items-center min-h-11 sm:min-h-0 font-medium underline underline-offset-2 cursor-pointer"
      >
        {open ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
      </button>
      <span id={detailId} hidden={!open} className="block mt-1 font-mono text-xs break-words opacity-80">
        {error.detail ?? `${error.message}${error.code ? ` (código ${error.code})` : ''}`}
      </span>
    </>
  )
}
