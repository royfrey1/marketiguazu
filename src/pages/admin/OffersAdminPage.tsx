import { useEffect, useState } from 'react'
import { BadgePercent, Loader2, Plus, RefreshCw } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import OffersTable, { type RemoveTarget } from '../../components/admin/offers/OffersTable'
import AddOfferDialog from '../../components/admin/offers/AddOfferDialog'
import { offersService, type AdminOffer } from '../../services/offers.service'

export default function OffersAdminPage() {
  const [offers, setOffers] = useState<AdminOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<RemoveTarget | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: loadError } = await offersService.listAdmin()
      if (!cancelled) {
        setOffers(data)
        setError(loadError?.message ?? null)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const confirmRemove = async () => {
    if (!removing) return
    setRemoveLoading(true)
    // Se manda la fila completa con sus valores actuales: solo cambia en_oferta (el precio queda igual)
    const { error: removeError } = removing.variant
      ? await offersService.setVariantOffer(removing.variant.id, false)
      : await offersService.setProductOffer(removing.offer.productId, false)
    setRemoveLoading(false)
    if (removeError) {
      sileo.error({ title: 'No se pudo quitar la oferta', description: removeError.message })
      return
    }
    sileo.success({ title: 'Oferta quitada', description: removing.offer.titulo })
    setRemoving(null)
    refresh()
  }

  const removingLabel = removing
    ? removing.variant ? `${removing.offer.titulo} · ${removing.variant.nombre}` : removing.offer.titulo
    : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Ofertas</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
            Productos y variantes que se muestran en oferta en la tienda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="p-2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title="Recargar"
            aria-label="Recargar ofertas"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agregar a ofertas
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4 space-y-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex items-center gap-4">
              <Skeleton width="2.5rem" height="2.5rem" rounded="lg" />
              <div className="flex-1">
                <Skeleton height="0.875rem" width="45%" rounded="lg" />
                <Skeleton height="0.75rem" width="20%" rounded="lg" className="mt-2" />
              </div>
              <Skeleton height="0.875rem" width="4rem" rounded="lg" />
            </div>
          ))}
        </div>
      ) : offers.length === 0 && !error ? (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 px-6 py-12 text-center">
          <BadgePercent className="w-10 h-10 mx-auto text-gray-300 dark:text-white/20" aria-hidden="true" />
          <p className="mt-3 font-semibold text-gray-700 dark:text-white/70">Todavía no hay ofertas</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
            Agregá un producto o una variante con “Agregar a ofertas”, o marcá “Mostrar en Ofertas” al editar un producto.
          </p>
        </div>
      ) : (
        <OffersTable offers={offers} onRemove={setRemoving} />
      )}

      {addOpen && (
        <AddOfferDialog
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); refresh() }}
        />
      )}

      {removing && (
        <Modal
          open
          onClose={() => { if (!removeLoading) setRemoving(null) }}
          title="Quitar de ofertas"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                disabled={removeLoading}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={removeLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {removeLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Quitar de ofertas
              </button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 dark:text-white/60">
            ¿Quitar <strong className="text-gray-800 dark:text-white/80">{removingLabel}</strong> de ofertas? El precio no cambia: solo deja de mostrarse como oferta.
          </p>
        </Modal>
      )}
    </div>
  )
}
