import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Boxes, Loader2, RefreshCw } from 'lucide-react'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import { Alert } from '../products/BulkPriceChangeDialog'
import StockChangePreview, { type StockPreviewFilter } from './StockChangePreview'
import {
  MAX_STOCK_ROWS,
  MOTIVO_MAX,
  buildStockPreview,
  motivoError,
  parseIntegerInput,
  stockChangeMeta,
  stockRowDetail,
  valueError,
  type StockChangeConfig,
  type StockChangeMode,
  type StockRowData,
  type StockSelectedItem,
} from '../../../lib/stockChange'
import {
  stockChangeService,
  type StockChangeError,
  type StockProblem,
} from '../../../services/stockChange.service'

export interface StockChangeApplied {
  batchId: string
  rows: number
}

interface BulkStockChangeDialogProps {
  items: StockSelectedItem[]
  onClose: () => void
  /** Se aplicó un lote: cerrar, avisar en la página con Deshacer, limpiar la selección y recargar */
  onApplied: (result: StockChangeApplied) => void
  /** Error inesperado al aplicar: verificar en "Cambios recientes" si se aplicó */
  onOpenRecent: () => void
}

type Phase = 'config' | 'loading' | 'loadError' | 'preview' | 'applying' | 'noChanges'

const MODES: { value: StockChangeMode; label: string; help: string }[] = [
  { value: 'set', label: 'Fijar stock', help: 'Todas las filas quedan con el mismo stock (por ejemplo, 10). Con 0 quedan sin stock.' },
  { value: 'add', label: 'Sumar unidades', help: 'Suma la misma cantidad al stock de cada fila (por ejemplo, entró mercadería).' },
  { value: 'sub', label: 'Restar unidades', help: 'Resta la misma cantidad a cada fila. Las que no alcanzan quedan afuera: no se recortan a 0.' },
]

const PROBLEM_LABELS: Record<StockProblem['motivo'], string> = {
  no_existe: 'ya no existe',
  duplicado: 'aparece repetida',
  en_papelera: 'el producto está en la papelera',
  stock_cambiado: 'el stock cambió',
  stock_invalido: 'quedaría por debajo de lo reservado',
}

const FILTERS: { value: StockPreviewFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'modificados', label: 'Solo modificados' },
  { value: 'excluidos', label: 'Solo excluidas' },
]

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('es-AR')} ${count === 1 ? one : many}`

const radioCard = (checked: boolean) =>
  `flex items-center gap-2 min-h-tap sm:min-h-10 px-3 rounded-lg border text-sm cursor-pointer select-none transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#185749]/40 dark:has-[:focus-visible]:ring-[#1CAAA8]/40 ${
    checked
      ? 'border-[#185749] bg-[#185749]/5 text-[#0D3732] dark:border-[#1CAAA8] dark:bg-[#1CAAA8]/10 dark:text-white'
      : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5'
  }`

const btnPrimary = 'min-h-tap sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#185749] hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const btnSecondary = 'min-h-tap sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

const inputClass = (invalid: boolean) =>
  `w-full min-h-tap sm:min-h-10 px-3 text-sm rounded-lg border bg-transparent text-gray-800 dark:text-white/90 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 ${
    invalid ? 'border-red-500' : 'border-gray-200 dark:border-white/10 focus:border-[#185749] dark:focus:border-[#1CAAA8]'
  }`

export default function BulkStockChangeDialog({ items, onClose, onApplied, onOpenRecent }: BulkStockChangeDialogProps) {
  const [phase, setPhase] = useState<Phase>('config')
  const [modo, setModo] = useState<StockChangeMode>('set')
  const [valorText, setValorText] = useState('')
  const [motivo, setMotivo] = useState('')
  const [touched, setTouched] = useState({ valor: false, motivo: false })
  const [config, setConfig] = useState<StockChangeConfig | null>(null)
  const [data, setData] = useState<StockRowData[]>([])
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [filter, setFilter] = useState<StockPreviewFilter>('todos')
  /** Aviso tras regenerar la vista previa por P4096 (el stock cambió) */
  const [notice, setNotice] = useState<StockChangeError | null>(null)
  const [applyError, setApplyError] = useState<{ error: StockChangeError; affected: string[] } | null>(null)
  const applyingRef = useRef(false)
  const loadSeq = useRef(0)
  const valueRef = useRef<HTMLInputElement>(null)
  const motivoRef = useRef<HTMLInputElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)
  const previewTopRef = useRef<HTMLDivElement>(null)
  const ids = useId()

  const vError = valueError(modo, valorText)
  const mError = motivoError(motivo)
  const showVError = touched.valor && !!vError
  const showMError = touched.motivo && !!mError
  const motivoLength = motivo.trim().length

  const preview = useMemo(() => (config ? buildStockPreview(items, data, config) : null), [config, data, items])

  // Foco: al cargar, en el estado; al mostrar la vista previa (o un aviso), arriba de la vista previa
  useEffect(() => {
    if (phase === 'loading') loadingRef.current?.focus()
    else if (phase === 'preview') previewTopRef.current?.focus()
  }, [phase, notice, applyError])

  /** Lee el stock actual (fresco) y arma la vista previa */
  const loadPreview = async (cfg: StockChangeConfig) => {
    const seq = ++loadSeq.current
    setConfig(cfg)
    setPhase('loading')
    setLoadError(null)
    const { data: fresh, error: readError } = await stockChangeService.getStockChangeRows(items.map(i => i.id))
    if (seq !== loadSeq.current) return
    if (readError) {
      setLoadError(readError)
      setPhase('loadError')
      return
    }
    setData(fresh)
    setPhase('preview')
  }

  const goToPreview = () => {
    setTouched({ valor: true, motivo: true })
    const valor = parseIntegerInput(valorText)
    if (vError || valor === null) {
      valueRef.current?.focus()
      return
    }
    if (mError) {
      motivoRef.current?.focus()
      return
    }
    setNotice(null)
    setApplyError(null)
    setFilter('todos')
    void loadPreview({ modo, valor, motivo: motivo.trim() })
  }

  /** Filas con problemas (para el mensaje), nombradas con los datos de la vista previa */
  const affectedRows = (problems: StockProblem[]) => {
    const names = new Map<number, string>()
    for (const i of items) names.set(i.id, i.variante ? `${i.titulo} (${i.variante})` : i.titulo)
    for (const r of data) {
      const detail = stockRowDetail(r)
      names.set(r.id, detail ? `${r.product_titulo} (${detail})` : r.product_titulo)
    }
    const lines = new Map<string, string>()
    for (const problem of problems) {
      const name = (problem.inventory_id !== null ? names.get(problem.inventory_id) : undefined) ?? 'Una fila'
      lines.set(`${name}|${problem.motivo}`, `${name}: ${PROBLEM_LABELS[problem.motivo] ?? 'tiene un problema'}`)
    }
    return [...lines.values()]
  }

  const apply = async () => {
    if (!preview || !config || applyingRef.current) return
    if (preview.items.length === 0 || preview.tooManyRows) return
    applyingRef.current = true
    setNotice(null)
    setApplyError(null)
    setPhase('applying')
    const { data: result, error: rpcError } = await stockChangeService.applyStockChangeBulk(preview.items, stockChangeMeta(config))
    applyingRef.current = false

    if (!rpcError && result) {
      if (result.batch_id) onApplied({ batchId: result.batch_id, rows: result.changed })
      else setPhase('noChanges')
      return
    }

    const err = rpcError as StockChangeError
    if (err.key === 'STOCK_CHANGED') {
      setNotice(err)
      await loadPreview(config)
      return
    }
    if (err.key === 'BELOW_RESERVED' || err.key === 'IN_TRASH' || err.key === 'NOT_FOUND') {
      setApplyError({ error: err, affected: affectedRows(err.problems) })
      await loadPreview(config)
      return
    }
    // 22023, P4094, P4003 y los inesperados: sin reintento automático
    setApplyError({ error: err, affected: [] })
    setPhase('preview')
  }

  const running = phase === 'applying'
  const canApply = !!preview && preview.items.length > 0 && !preview.tooManyRows
  const modeInfo = MODES.find(m => m.value === modo)!

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!running}
      title={`Cambiar stock de ${plural(items.length, 'fila', 'filas')}`}
      size="xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {phase === 'config' && (
            <>
              <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
              <button type="button" onClick={goToPreview} disabled={!!vError || !!mError} className={btnPrimary}>
                Ver vista previa
              </button>
            </>
          )}
          {(phase === 'loading' || phase === 'loadError') && (
            <>
              <button type="button" onClick={() => { loadSeq.current++; setPhase('config') }} className={btnSecondary}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Volver
              </button>
              {phase === 'loadError' && config && (
                <button type="button" onClick={() => void loadPreview(config)} className={btnPrimary}>
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  Reintentar
                </button>
              )}
            </>
          )}
          {phase === 'preview' && (
            <>
              <button type="button" onClick={() => { setNotice(null); setApplyError(null); setPhase('config') }} className={btnSecondary}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Cambiar configuración
              </button>
              <button type="button" onClick={() => void apply()} disabled={!canApply} className={btnPrimary}>
                <Boxes className="w-4 h-4" aria-hidden="true" />
                Confirmar y aplicar
              </button>
            </>
          )}
          {running && (
            <button type="button" disabled className={`${btnPrimary} cursor-wait`}>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Aplicando...
            </button>
          )}
          {phase === 'noChanges' && (
            <button type="button" ref={el => el?.focus()} onClick={onClose} className={btnPrimary}>Cerrar</button>
          )}
        </div>
      }
    >
      {phase === 'config' && (
        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">Tipo de cambio</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MODES.map(m => (
                <label key={m.value} className={radioCard(modo === m.value)}>
                  <input
                    type="radio"
                    name={`${ids}-modo`}
                    value={m.value}
                    checked={modo === m.value}
                    onChange={() => setModo(m.value)}
                    ref={modo === m.value ? el => el?.setAttribute('autofocus', '') : undefined}
                    className="accent-[#185749] dark:accent-[#1CAAA8]"
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-2">{modeInfo.help}</p>
          </fieldset>

          <div>
            <label htmlFor={`${ids}-valor`} className="block text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
              {modo === 'set' ? 'Stock nuevo' : 'Unidades'}
            </label>
            <div className="max-w-xs">
              <input
                ref={valueRef}
                id={`${ids}-valor`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={valorText}
                onChange={e => setValorText(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, valor: true }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goToPreview() } }}
                aria-invalid={showVError}
                aria-describedby={`${ids}-valor-help${showVError ? ` ${ids}-valor-error` : ''}`}
                placeholder={modo === 'set' ? '10' : '5'}
                className={inputClass(showVError)}
              />
            </div>
            <p id={`${ids}-valor-help`} className="text-xs text-gray-500 dark:text-white/50 mt-1">
              {modo === 'set' ? 'Número entero de 0 a 1.000.000.' : 'Número entero, al menos 1. Podés escribir 1.500 o 1500.'}
            </p>
            <p id={`${ids}-valor-error`} role="alert" className="text-xs font-medium text-red-700 dark:text-red-400 mt-1 min-h-4">
              {showVError ? vError : ''}
            </p>
          </div>

          <div>
            <label htmlFor={`${ids}-motivo`} className="block text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
              Motivo
            </label>
            <input
              ref={motivoRef}
              id={`${ids}-motivo`}
              type="text"
              autoComplete="off"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, motivo: true }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goToPreview() } }}
              aria-invalid={showMError}
              aria-describedby={`${ids}-motivo-help${showMError ? ` ${ids}-motivo-error` : ''}`}
              placeholder="Por ejemplo: conteo de depósito de octubre"
              className={inputClass(showMError)}
            />
            <div className="flex items-start justify-between gap-3 mt-1">
              <p id={`${ids}-motivo-help`} className="text-xs text-gray-500 dark:text-white/50">
                Obligatorio. Queda en el historial de movimientos de cada fila.
              </p>
              <p
                className={`text-xs tabular-nums shrink-0 ${motivoLength > MOTIVO_MAX ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-white/50'}`}
                aria-live="polite"
              >
                {motivoLength}/{MOTIVO_MAX}
              </p>
            </div>
            <p id={`${ids}-motivo-error`} role="alert" className="text-xs font-medium text-red-700 dark:text-red-400 mt-1 min-h-4">
              {showMError ? mError : ''}
            </p>
          </div>

          <p className="text-xs text-gray-500 dark:text-white/50">
            Cambia el stock total de cada fila; lo reservado y el umbral de stock bajo no se tocan. Antes de aplicar
            vas a ver una vista previa.
          </p>
        </div>
      )}

      {phase === 'loading' && (
        <div ref={loadingRef} tabIndex={-1} role="status" className="outline-none flex items-center gap-2 text-sm text-gray-700 dark:text-white/70 py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Leyendo el stock actual de {plural(items.length, 'fila', 'filas')}...
        </div>
      )}

      {phase === 'loadError' && loadError && (
        <Alert tone="red" role="alert">
          <p><FriendlyError error={loadError} prefix="No se pudo leer el stock actual. " /></p>
        </Alert>
      )}

      {phase === 'applying' && (
        <div role="status" className="flex items-center gap-2 text-sm text-gray-700 dark:text-white/70 py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Aplicando el cambio de stock... No cierres esta ventana.
        </div>
      )}

      {phase === 'noChanges' && (
        <div role="status">
          <Alert tone="info">
            <p>No hubo cambios: el stock ya estaba así.</p>
          </Alert>
        </div>
      )}

      {phase === 'preview' && preview && config && (
        <div className="space-y-3">
          <div ref={previewTopRef} tabIndex={-1} className="outline-none space-y-3" aria-live="polite">
            {notice && (
              <Alert tone="amber" role="status">
                <p><FriendlyError error={notice} /></p>
                <p>Actualizamos la vista previa con el stock de ahora: revisala y confirmá de nuevo.</p>
              </Alert>
            )}
            {applyError && (
              <Alert tone="red" role="alert">
                <p><FriendlyError error={applyError.error} /></p>
                {applyError.affected.length > 0 && (
                  <>
                    <p>Filas afectadas (la vista previa ya se actualizó con los datos de ahora):</p>
                    <ul className="list-disc pl-5">
                      {applyError.affected.slice(0, 10).map(line => <li key={line} className="break-words">{line}</li>)}
                      {applyError.affected.length > 10 && <li>y {applyError.affected.length - 10} más</li>}
                    </ul>
                  </>
                )}
                {applyError.error.key === 'UNKNOWN' && (
                  <p>
                    No sabemos si el cambio se llegó a aplicar. Antes de reintentar, revisá{' '}
                    <button type="button" onClick={onOpenRecent} className="font-semibold underline underline-offset-2 cursor-pointer min-h-tap sm:min-h-0">
                      Cambios recientes
                    </button>
                    .
                  </p>
                )}
              </Alert>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
                <dt className="text-xs text-gray-500 dark:text-white/50">Se modificarán</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">{plural(preview.counts.modificadas, 'fila', 'filas')}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
                <dt className="text-xs text-gray-500 dark:text-white/50">Sin cambio</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">{plural(preview.counts.sinCambio, 'fila', 'filas')}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
                <dt className="text-xs text-gray-500 dark:text-white/50">Excluidas (se ajustan a mano)</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">{plural(preview.counts.excluidas, 'fila', 'filas')}</dd>
              </div>
            </dl>
          </div>

          <p className="text-sm text-gray-700 dark:text-white/70 break-words">
            <span className="font-semibold">Motivo:</span> {config.motivo}
          </p>

          {preview.tooManyRows && (
            <Alert tone="red" role="alert">
              <p>
                Son demasiadas filas para un solo cambio: el máximo es {MAX_STOCK_ROWS} filas con cambio y hoy hay{' '}
                {preview.counts.modificadas.toLocaleString('es-AR')}. Elegí menos filas.
              </p>
            </Alert>
          )}
          {!preview.tooManyRows && preview.items.length === 0 && (
            <Alert tone="info"><p>No hay stock para modificar con esta configuración.</p></Alert>
          )}
          {preview.counts.agotadas > 0 && (
            <Alert tone="amber">
              <p>
                {preview.counts.agotadas === 1
                  ? '1 fila quedará agotada: deja de poder comprarse en la tienda.'
                  : `${preview.counts.agotadas.toLocaleString('es-AR')} filas quedarán agotadas: dejan de poder comprarse en la tienda.`}
              </p>
            </Alert>
          )}

          <div role="group" aria-label="Filtrar la vista previa" className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`min-h-tap sm:min-h-8 px-3 text-xs font-medium rounded-full border cursor-pointer ${
                  filter === f.value
                    ? 'border-[#185749] bg-[#185749] text-white dark:border-[#1CAAA8] dark:bg-[#1CAAA8]'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <StockChangePreview preview={preview} filter={filter} />
        </div>
      )}
    </Modal>
  )
}
