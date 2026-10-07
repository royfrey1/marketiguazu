import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Fallback para navegadores sin Clipboard API o fuera de contexto seguro
function copyWithTextarea(value: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const handleCopy = async () => {
    let ok: boolean
    try {
      await navigator.clipboard.writeText(value)
      ok = true
    } catch {
      ok = copyWithTextarea(value)
    }
    // Sin portapapeles el valor sigue visible para copiarlo a mano
    if (!ok) return
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center gap-1.5 shrink-0 min-h-11 min-w-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-primary-dark hover:border-accent hover:text-accent transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={label}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-accent" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Copiado' : 'Copiar'}</span>
    </button>
  )
}
