import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { inventoryService, type InventoryMovement } from '../../../services/inventory.service'
import Modal from '../../ui/Modal'

interface InventoryMovementDialogProps {
  inventoryId: number
  productTitle: string
  onClose: () => void
}

type MovementWithProfile = InventoryMovement & {
  profiles: { id: string; nombre: string | null } | null
}

const tipoLabels: Record<string, string> = {
  restock: 'Restock',
  sale: 'Venta',
  reservation: 'Reserva',
  release: 'Liberación',
  adjustment: 'Ajuste',
  return: 'Devolución',
}

const direccionLabels: Record<string, string> = {
  increase: '+',
  decrease: '-',
}

export default function InventoryMovementDialog({ inventoryId, productTitle, onClose }: InventoryMovementDialogProps) {
  const [movements, setMovements] = useState<MovementWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await inventoryService.getMovements(inventoryId)
      if (!cancelled) {
        if (error) {
          setError(error.message)
        } else {
          setMovements((data as MovementWithProfile[]) || [])
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [inventoryId])

  return (
    <Modal
      open
      onClose={onClose}
      title="Historial de movimientos"
      description={productTitle}
      size="lg"
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
      ) : movements.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-white/40">Sin movimientos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {movements.map((m) => (
            <div key={m.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.02] rounded-lg">
              <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                m.direccion === 'increase'
                  ? 'bg-[#389C52]/10 text-[#389C52]'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              }`}>
                {direccionLabels[m.direccion] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-white/80">
                    {tipoLabels[m.tipo] || m.tipo}
                  </span>
                  <span className={`text-sm font-semibold ${m.direccion === 'increase' ? 'text-[#389C52]' : 'text-red-600 dark:text-red-400'}`}>
                    {direccionLabels[m.direccion]}{m.cantidad}
                  </span>
                </div>
                {m.notas && (
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5 truncate">{m.notas}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-white/30">
                  <span>{new Date(m.created_at).toLocaleString('es-AR')}</span>
                  {m.profiles?.nombre && (
                    <>
                      <span>·</span>
                      <span>{m.profiles.nombre}</span>
                    </>
                  )}
                  {m.referencia_tipo && (
                    <>
                      <span>·</span>
                      <span>{m.referencia_tipo}{m.referencia_id ? ` #${m.referencia_id}` : ''}</span>
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
