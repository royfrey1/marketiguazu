import Modal from '../ui/Modal'
import Button from '../ui/Button'
import type { MergeStrategy } from './CartContext'

interface CartMergeModalProps {
  open: boolean
  onSelect: (strategy: MergeStrategy) => void
  loading: boolean
  localCount: number
  serverCount: number
}

export default function CartMergeModal({
  open,
  onSelect,
  loading,
  localCount,
  serverCount,
}: CartMergeModalProps) {
  return (
    <Modal open={open} onClose={() => {}} title="Tus carritos">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          Encontramos productos guardados de una visita anterior y también tenés un carrito actual.
          ¿Qué querés hacer?
        </p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-lg">🛒</span>
            <div>
              <p className="font-semibold text-gray-800">Carrito actual</p>
              <p className="text-gray-500">{serverCount} producto{serverCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-lg">📦</span>
            <div>
              <p className="font-semibold text-gray-800">Carrito anterior</p>
              <p className="text-gray-500">{localCount} producto{localCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="primary"
            size="md"
            loading={loading}
            onClick={() => onSelect('local')}
          >
            Usar mi carrito anterior
          </Button>
          <Button
            variant="secondary"
            size="md"
            loading={loading}
            onClick={() => onSelect('server')}
          >
            Usar mi carrito actual
          </Button>
          <Button
            variant="outline"
            size="md"
            loading={loading}
            onClick={() => onSelect('merge')}
          >
            Combinar ambos
          </Button>
        </div>
      </div>
    </Modal>
  )
}
