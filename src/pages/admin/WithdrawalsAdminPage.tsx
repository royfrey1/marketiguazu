import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, RefreshCw, AlertTriangle, Eye, MessageCircle, Loader2 } from 'lucide-react'
import { sileo } from 'sileo'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import { withdrawalService, type WithdrawalItemSummary } from '../../services/withdrawal.service'
import {
  WITHDRAWAL_STATUSES,
  WITHDRAWAL_STATUS_MAP,
  WITHDRAWALS_CHANGED_EVENT,
  OPEN_WITHDRAWAL_STATUSES,
  isWithdrawalStatus,
  type WithdrawalAdminFilter,
  type WithdrawalRow,
  type WithdrawalStatus,
} from '../../types/withdrawal'
import { whatsappLinkFromPhone } from '../../lib/phone'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: { value: WithdrawalAdminFilter; label: string }[] = [
  { value: 'open', label: 'Abiertas (recibidas y en gestión)' },
  { value: 'received', label: 'Recibidas' },
  { value: 'in_progress', label: 'En gestión' },
  { value: 'completed', label: 'Completadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
]

const FIELD_CLASS = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent dark:bg-[#1A2B27] text-gray-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const info = isWithdrawalStatus(status) ? WITHDRAWAL_STATUS_MAP[status] : { label: status, variant: 'default' as const }
  return <Badge variant={info.variant} className="whitespace-nowrap">{info.label}</Badge>
}

function DeadlineBadge({ within }: { within: boolean }) {
  return <Badge variant={within ? 'success' : 'default'} className="whitespace-nowrap">{within ? 'Dentro de plazo' : 'Fuera de plazo'}</Badge>
}

function scopeLabel(row: WithdrawalRow): string {
  if (!row.order_item_ids || row.order_item_ids.length === 0) return 'Todo el pedido'
  return `${row.order_item_ids.length} ${row.order_item_ids.length === 1 ? 'producto' : 'productos'}`
}

function matchesFilter(status: string, filter: WithdrawalAdminFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'open') return (OPEN_WITHDRAWAL_STATUSES as string[]).includes(status)
  return status === filter
}

// ---------------------------------------------------------------------------
// Detalle / gestión
// ---------------------------------------------------------------------------

function WithdrawalDetailModal({ row, onClose, onSaved }: {
  row: WithdrawalRow
  onClose: () => void
  onSaved: (updated: WithdrawalRow) => void
}) {
  const [context, setContext] = useState<{ items: WithdrawalItemSummary[]; telefono: string | null; error: string | null } | null>(null)
  const [status, setStatus] = useState<WithdrawalStatus>(isWithdrawalStatus(row.status) ? row.status : 'received')
  const [notes, setNotes] = useState(row.admin_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    withdrawalService.getWithdrawalContextAdmin(row.order_id, row.order_item_ids).then(res => {
      if (!cancelled) setContext({ items: res.items, telefono: res.telefono, error: res.error?.message ?? null })
    })
    return () => { cancelled = true }
  }, [row.order_id, row.order_item_ids])

  const whatsappHref = context?.telefono
    ? whatsappLinkFromPhone(
        context.telefono,
        `Hola ${row.nombre}! Te escribimos de Iguazú Marketplace por tu solicitud de arrepentimiento ${row.numero} del pedido ${row.numero_pedido}.`
      )
    : null

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const { data, error } = await withdrawalService.updateWithdrawalAdmin(row.id, status, notes.trim() || null)
    setSaving(false)
    if (error || !data) {
      setSaveError(error ?? 'No se pudo guardar.')
      return
    }
    sileo.success({ title: 'Solicitud actualizada', description: `${data.numero}: ${WITHDRAWAL_STATUS_MAP[status].label}` })
    onSaved(data)
  }

  return (
    <Modal
      open
      onClose={() => { if (!saving) onClose() }}
      title={`Solicitud ${row.numero}`}
      description={`Pedido ${row.numero_pedido} · ${formatDateTime(row.created_at)}`}
      size="lg"
    >
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={row.status} />
          <DeadlineBadge within={row.within_deadline} />
          <Link to={`/admin/pedido/${row.order_id}`} className="text-xs font-semibold text-[#185749] dark:text-[#1CAAA8] hover:underline">
            Ver pedido {row.numero_pedido}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 dark:text-white/30">Nombre</p>
            <p className="font-medium text-gray-800 dark:text-white/80 break-words">{row.nombre}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-white/30">Email</p>
            <p className="font-medium text-gray-800 dark:text-white/80 break-all">{row.email}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Motivo</p>
          <p className="text-gray-700 dark:text-white/70 whitespace-pre-wrap break-words">
            {row.motivo || <span className="text-gray-400 dark:text-white/30">Sin motivo (no es obligatorio)</span>}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-1">
            Productos solicitados {!row.order_item_ids && '(todo el pedido)'}
          </p>
          {!context ? (
            <p className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
          ) : context.error ? (
            <p className="text-red-600 dark:text-red-400 text-xs">No se pudieron cargar los productos: {context.error}</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-white/70">
              {context.items.map(item => (
                <li key={item.id}>
                  {item.nombre_producto}{item.variante_nombre ? ` (${item.variante_nombre})` : ''} ×{item.cantidad}
                </li>
              ))}
            </ul>
          )}
        </div>

        {context && (
          <div>
            <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Teléfono</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-gray-700 dark:text-white/70">{context.telefono ?? 'El pedido no tiene teléfono'}</span>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#185749] dark:text-[#1CAAA8] hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Escribir por WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-white/5 pt-4 space-y-3">
          <div>
            <label htmlFor="withdrawal-admin-status" className="block text-xs font-medium text-gray-500 dark:text-white/40 mb-1">Estado</label>
            <select
              id="withdrawal-admin-status"
              value={status}
              onChange={e => { if (isWithdrawalStatus(e.target.value)) setStatus(e.target.value) }}
              disabled={saving}
              className={`${FIELD_CLASS} cursor-pointer`}
            >
              {WITHDRAWAL_STATUSES.map(s => <option key={s} value={s}>{WITHDRAWAL_STATUS_MAP[s].label}</option>)}
            </select>
          </div>

          {status === 'completed' && (
            <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              Recordá cancelar el pedido, hacer el reembolso por el medio de pago original (en USDT, la misma cantidad recibida) y reponer el stock a mano en Inventario. Marcarla como completada no hace nada de eso automáticamente.
            </p>
          )}

          <div>
            <label htmlFor="withdrawal-admin-notes" className="block text-xs font-medium text-gray-500 dark:text-white/40 mb-1">Notas internas</label>
            <textarea
              id="withdrawal-admin-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={saving}
              placeholder="Solo las ve el equipo (ej: coordinado retiro por WhatsApp)"
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          {saveError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cerrar</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>Guardar</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function WithdrawalsAdminPage() {
  const [filter, setFilter] = useState<WithdrawalAdminFilter>('open')
  const [rows, setRows] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selected, setSelected] = useState<WithdrawalRow | null>(null)

  useEffect(() => {
    let cancelled = false
    withdrawalService.listWithdrawalsAdmin(filter).then(({ data, error: fetchError }) => {
      if (cancelled) return
      setRows(data)
      setError(fetchError?.message ?? null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [filter, reloadKey])

  const refetch = () => { setLoading(true); setReloadKey(k => k + 1) }
  const changeFilter = (value: WithdrawalAdminFilter) => { setLoading(true); setFilter(value) }

  const handleSaved = (updated: WithdrawalRow) => {
    setRows(prev => prev
      .map(r => (r.id === updated.id ? updated : r))
      .filter(r => matchesFilter(r.status, filter)))
    setSelected(null)
    window.dispatchEvent(new Event(WITHDRAWALS_CHANGED_EVENT))
  }

  const viewButton = (row: WithdrawalRow, full = false) => (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); setSelected(row) }}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium text-[#185749] dark:text-[#1CAAA8] border border-[#185749]/20 dark:border-[#1CAAA8]/20 rounded-lg hover:bg-[#185749]/5 dark:hover:bg-[#1CAAA8]/5 transition-colors cursor-pointer ${full ? 'w-full py-2 text-sm' : ''}`}
    >
      <Eye className="w-3.5 h-3.5" />
      Gestionar
    </button>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Arrepentimientos</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
            Solicitudes del botón de arrepentimiento. {!loading && `${rows.length} ${rows.length === 1 ? 'solicitud' : 'solicitudes'}`}
          </p>
        </div>
        <button
          onClick={refetch}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-[#1CAAA8]/30 bg-[#1CAAA8]/10 text-[#1CAAA8] hover:bg-[#1CAAA8]/20 transition-colors cursor-pointer"
          title="Actualizar"
          aria-label="Actualizar solicitudes"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4">
        <label htmlFor="withdrawal-filter" className="sr-only">Filtrar por estado</label>
        <select
          id="withdrawal-filter"
          value={filter}
          onChange={e => changeFilter(e.target.value as WithdrawalAdminFilter)}
          className={`${FIELD_CLASS} sm:w-72 cursor-pointer`}
        >
          {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4 flex items-start gap-2">
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">No se pudieron cargar las solicitudes: {error}</p>
          <button onClick={refetch} className="text-xs text-red-500 hover:text-red-700 cursor-pointer shrink-0">Reintentar</button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => <Skeleton key={n} height="3.5rem" rounded="xl" />)}
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
          <RotateCcw className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-600 dark:text-white/50 mb-1">No hay solicitudes para mostrar</h3>
          <p className="text-sm text-gray-400 dark:text-white/25">
            {filter === 'open' ? 'No hay solicitudes abiertas.' : 'Probá con otro filtro.'}
          </p>
        </div>
      ) : rows.length > 0 && (
        <>
          {/* Desktop (>=1280px). overflow-x-auto: si igual no entra, se scrollea y la acción nunca se pierde */}
          <div className="hidden xl:block bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5">
                  {[
                    { label: 'Constancia' }, { label: 'Pedido' }, { label: 'Cliente' }, { label: 'Fecha' },
                    { label: 'Plazo' }, { label: 'Estado' }, { label: 'Alcance', className: 'hidden 2xl:table-cell' }, { label: '' },
                  ].map(h => (
                    <th key={h.label} className={`text-left px-3 py-3 font-medium text-gray-400 dark:text-white/30 whitespace-nowrap ${h.className ?? ''}`}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    onKeyDown={e => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(row) }
                    }}
                    tabIndex={0}
                    aria-label={`Gestionar solicitud ${row.numero}`}
                    className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1CAAA8]"
                  >
                    <td className="px-3 py-3 font-bold text-gray-800 dark:text-white/80 whitespace-nowrap">{row.numero}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link
                        to={`/admin/pedido/${row.order_id}`}
                        onClick={e => e.stopPropagation()}
                        className="font-bold text-[#185749] dark:text-[#1CAAA8] hover:underline"
                      >
                        #{row.numero_pedido}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-40 2xl:w-56">
                        <p className="text-gray-700 dark:text-white/70 truncate" title={row.nombre}>{row.nombre}</p>
                        <p className="text-xs text-gray-400 dark:text-white/30 truncate" title={row.email}>{row.email}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 dark:text-white/40 whitespace-nowrap">
                      <p>{formatDate(row.created_at)}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30">{formatTime(row.created_at)}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap"><DeadlineBadge within={row.within_deadline} /></td>
                    <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-3 text-gray-500 dark:text-white/40 whitespace-nowrap hidden 2xl:table-cell">{scopeLabel(row)}</td>
                    <td className="px-3 py-3 text-right">{viewButton(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet / laptop cards (<1280px) */}
          <div className="xl:hidden space-y-3">
            {rows.map(row => (
              <div key={row.id} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 dark:text-white/80">{row.numero}</p>
                    <Link to={`/admin/pedido/${row.order_id}`} className="text-sm font-bold text-[#185749] dark:text-[#1CAAA8] hover:underline">
                      #{row.numero_pedido}
                    </Link>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-white/30 text-right shrink-0">{formatDateTime(row.created_at)}</p>
                </div>
                <div className="text-sm min-w-0">
                  <p className="text-gray-700 dark:text-white/70 break-words">{row.nombre}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 break-all">{row.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.status} />
                  <DeadlineBadge within={row.within_deadline} />
                  <span className="text-xs text-gray-400 dark:text-white/30">{scopeLabel(row)}</span>
                </div>
                {viewButton(row, true)}
              </div>
            ))}
          </div>
        </>
      )}

      {selected && (
        <WithdrawalDetailModal key={selected.id} row={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}
