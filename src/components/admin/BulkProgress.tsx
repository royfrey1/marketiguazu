import { Loader2 } from 'lucide-react'

interface BulkProgressProps {
  /** Por ejemplo "Eliminando 3 de 12..." */
  label: string
  done: number
  total: number
  /** Nombre del elemento en curso */
  current?: string
}

/** Progreso de una acción masiva (genérico): texto, barra y el elemento en curso */
export default function BulkProgress({ label, done, total, current }: BulkProgressProps) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/70" aria-live="polite">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        {label}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden"
      >
        <div className="h-full bg-[#185749] dark:bg-[#1CAAA8] transition-[width] duration-200" style={{ width: `${percent}%` }} />
      </div>
      {current && <p className="text-xs text-gray-500 dark:text-white/40 break-words line-clamp-2">{current}</p>}
    </div>
  )
}
