import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { InventoryAdminRow } from '../../../services/inventory.service'
import Modal from '../../ui/Modal'

interface InventoryAdjustDialogProps {
  inventory: InventoryAdminRow
  onConfirm: (quantity: number, tipo: 'restock' | 'adjustment' | 'return', notas: string) => Promise<void>
  onClose: () => void
  loading: boolean
}

export default function InventoryAdjustDialog({ inventory, onConfirm, onClose, loading }: InventoryAdjustDialogProps) {
  const available = inventory.quantity - inventory.reserved

  const [tipo, setTipo] = useState<'restock' | 'adjustment' | 'return'>('restock')
  const [amount, setAmount] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  const amountNum = parseInt(amount, 10) || 0
  let newQuantity = inventory.quantity
  if (tipo === 'restock' || tipo === 'return') {
    newQuantity = inventory.quantity + amountNum
  } else {
    newQuantity = inventory.quantity - amountNum
  }

  const wouldBeBelowReserved = newQuantity < inventory.reserved
  const isNegative = newQuantity < 0
  const isValid = amountNum > 0 && !wouldBeBelowReserved && !isNegative

  const handleSubmit = async () => {
    if (!isValid) return
    setError(null)
    try {
      await onConfirm(newQuantity, tipo, notas)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const tipoLabels = {
    restock: 'Agregar stock',
    adjustment: 'Descontar stock',
    return: 'Devolución',
  }

  const ctaLabel = () => {
    if (tipo === 'restock' || tipo === 'return') {
      return `Agregar ${amountNum} unidades`
    }
    return `Descontar ${amountNum} unidades`
  }

  const inputClasses = "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajustar stock"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              isValid
                ? 'bg-[#185749] text-white hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/20 cursor-not-allowed'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {amountNum > 0 ? ctaLabel() : 'Confirmar'}
          </button>
        </div>
      }
    >
      {/* Current state */}
      <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-3">
        <p className="text-sm font-medium text-gray-800 dark:text-white/80">{inventory.product_titulo}</p>
        <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
          Stock: {inventory.quantity} · Reservado: {inventory.reserved} · Disponible: {available}
        </p>
      </div>

      {/* Operation type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Tipo de operación</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(['restock', 'adjustment', 'return'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                tipo === t
                  ? 'border-[#185749] dark:border-[#1CAAA8] bg-[#185749]/5 dark:bg-[#1CAAA8]/5 text-[#185749] dark:text-[#1CAAA8]'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              {tipoLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
          {tipo === 'restock' || tipo === 'return' ? 'Unidades a agregar' : 'Unidades a descontar'}
        </label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className={inputClasses}
        />
      </div>

      {/* Preview */}
      {amountNum > 0 && (
        <div className={`rounded-lg p-3 text-sm ${wouldBeBelowReserved || isNegative ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30' : 'bg-gray-50 dark:bg-white/[0.02]'}`}>
          <div className="flex justify-between text-gray-600 dark:text-white/60">
            <span>Actual:</span>
            <span className="font-medium">{inventory.quantity}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-white/60 mt-1">
            <span>{tipo === 'restock' || tipo === 'return' ? 'Suma:' : 'Resta:'}</span>
            <span className={`font-medium ${wouldBeBelowReserved || isNegative ? 'text-red-600 dark:text-red-400' : ''}`}>
              {tipo === 'restock' || tipo === 'return' ? '+' : '-'}{amountNum}
            </span>
          </div>
          <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-gray-200 dark:border-white/10">
            <span>Resultado:</span>
            <span className={wouldBeBelowReserved || isNegative ? 'text-red-600 dark:text-red-400' : 'text-[#389C52]'}>
              {newQuantity}
            </span>
          </div>
          {wouldBeBelowReserved && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Stock resultante ({newQuantity}) es menor que reservado ({inventory.reserved})
            </p>
          )}
          {isNegative && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Stock resultante no puede ser negativo
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Motivo (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Motivo del ajuste..."
          className={`${inputClasses} resize-none`}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-3">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </Modal>
  )
}
