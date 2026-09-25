import { useState, useEffect } from 'react'
import { Loader2, History } from 'lucide-react'
import { priceHistoryService, type PriceHistoryWithProfile } from '../../../services/priceHistory.service'
import Modal from '../../ui/Modal'

interface PriceHistoryDialogProps {
  variantId: number
  variantName: string
  onClose: () => void
}

const origenLabels: Record<string, string> = {
  manual: 'Manual',
  promotion: 'Promoción',
  bulk_update: 'Actualización masiva',
}

export default function PriceHistoryDialog({ variantId, variantName, onClose }: PriceHistoryDialogProps) {
  const [history, setHistory] = useState<PriceHistoryWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error: fetchError } = await priceHistoryService.getByVariantId(variantId)
      if (!cancelled) {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setHistory(data || [])
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [variantId])

  return (
    <Modal
      open
      onClose={onClose}
      title="Historial de precios"
      description={variantName}
      size="md"
      footer={
        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          Cerrar
        </button>
      }
    >
      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 dark:text-white/30 animate-spin mx-auto" />
          <p className="text-sm text-gray-400 dark:text-white/30 mt-2">Cargando historial...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-3">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8">
          <History className="w-8 h-8 text-gray-200 dark:text-white/10 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-white/40">Sin cambios de precio registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.02] rounded-lg">
              <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#185749]/10 dark:bg-[#1CAAA8]/10 text-[#185749] dark:text-[#1CAAA8]">
                $
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-white/40 line-through">
                    ${h.precio_anterior.toLocaleString('es-AR')}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-white/25">→</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/80">
                    ${h.precio_nuevo.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-white/30">
                  <span>{new Date(h.created_at).toLocaleString('es-AR')}</span>
                  <span>·</span>
                  <span>{origenLabels[h.origen] || h.origen}</span>
                  {h.profiles?.nombre && (
                    <>
                      <span>·</span>
                      <span>{h.profiles.nombre}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
