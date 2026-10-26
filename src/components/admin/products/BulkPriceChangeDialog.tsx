import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, Info, Loader2, RefreshCw, Tag } from 'lucide-react'
import Modal from '../../ui/Modal'
import FriendlyError from '../FriendlyError'
import PriceChangePreview, { type PreviewFilter } from './PriceChangePreview'
import type { BulkProductItem } from './BulkRestoreProductsDialog'
import {
  BIG_CHANGE_PCT,
  MAX_ROWS_PER_CHANGE,
  ROUNDING_OPTIONS,
  buildPricePreview,
  configError,
  parseDecimalInput,
  priceChangeMeta,
  type PriceChangeConfig,
  type PriceChangeMode,
  type PriceChangeSign,
  type PriceProductData,
  type PriceRounding,
} from '../../../lib/priceChange'
import {
  priceChangeService,
  type PriceChangeError,
  type PriceProblem,
} from '../../../services/priceChange.service'

export interface PriceChangeApplied {
  batchId: string
  products: number
  variants: number
}

interface BulkPriceChangeDialogProps {
  items: BulkProductItem[]
  onClose: () => void
  /** Se aplicó un lote: cerrar, avisar en la página con Deshacer, limpiar la selección y recargar */
  onApplied: (result: PriceChangeApplied) => void
  /** Error inesperado al aplicar: verificar en "Cambios recientes" si se aplicó */
  onOpenRecent: () => void
}

type Phase = 'config' | 'loading' | 'loadError' | 'preview' | 'applying' | 'noChanges'

const MODES: { value: PriceChangeMode; label: string; help: string }[] = [
  { value: 'porcentaje', label: 'Porcentaje', help: 'Sube o baja cada precio en el mismo porcentaje (por ejemplo, 10%).' },
  { value: 'monto', label: 'Monto fijo', help: 'Suma o resta el mismo monto a cada precio (por ejemplo, $500).' },
  { value: 'exacto', label: 'Precio exacto', help: 'Todos los precios (productos y variantes) quedan en el mismo valor.' },
]

const PROBLEM_LABELS: Record<PriceProblem['motivo'], string> = {
  no_existe: 'ya no existe',
  duplicado: 'aparece repetido',
  en_papelera: 'está en la papelera',
  precio_cambiado: 'el precio cambió',
  oferta_invalida: 'la oferta quedaría inválida',
}

const FILTERS: { value: PreviewFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'modificados', label: 'Solo modificados' },
  { value: 'excluidos', label: 'Solo excluidos' },
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

export function Alert({ tone, children, role }: { tone: 'red' | 'amber' | 'info'; children: ReactNode; role?: 'alert' | 'status' }) {
  const styles = {
    red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200',
    info: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70',
  }[tone]
  const Icon = tone === 'info' ? Info : AlertTriangle
  return (
    <div role={role} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  )
}

export default function BulkPriceChangeDialog({ items, onClose, onApplied, onOpenRecent }: BulkPriceChangeDialogProps) {
  const [phase, setPhase] = useState<Phase>('config')
  const [modo, setModo] = useState<PriceChangeMode>('porcentaje')
  const [signo, setSigno] = useState<PriceChangeSign>('subir')
  const [valorText, setValorText] = useState('')
  const [redondeo, setRedondeo] = useState<PriceRounding>(1)
  const [touched, setTouched] = useState(false)
  const [config, setConfig] = useState<PriceChangeConfig | null>(null)
  const [data, setData] = useState<PriceProductData[]>([])
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [filter, setFilter] = useState<PreviewFilter>('todos')
  const [ack, setAck] = useState(false)
  /** Aviso tras regenerar la vista previa por P4096 (los precios cambiaron) */
  const [notice, setNotice] = useState<PriceChangeError | null>(null)
  const [applyError, setApplyError] = useState<{ error: PriceChangeError; affected: string[] } | null>(null)
  const applyingRef = useRef(false)
  const loadSeq = useRef(0)
  const valueRef = useRef<HTMLInputElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)
  const previewTopRef = useRef<HTMLDivElement>(null)
  const ids = useId()

  const error = configError(modo, signo, valorText)
  const showError = touched && !!error

  const preview = useMemo(() => (config ? buildPricePreview(items, data, config) : null), [config, data, items])

  // Foco: al cargar, en el estado; al mostrar la vista previa (o un aviso), arriba de la vista previa
  useEffect(() => {
    if (phase === 'loading') loadingRef.current?.focus()
    else if (phase === 'preview') previewTopRef.current?.focus()
  }, [phase, notice, applyError])

  /** Lee los precios actuales (frescos) y arma la vista previa */
  const loadPreview = async (cfg: PriceChangeConfig) => {
    const seq = ++loadSeq.current
    setConfig(cfg)
    setPhase('loading')
    setLoadError(null)
    const { data: fresh, error: readError } = await priceChangeService.getPriceChangeItems(items.map(i => i.id))
    if (seq !== loadSeq.current) return
    if (readError) {
      setLoadError(readError)
      setPhase('loadError')
      return
    }
    setData(fresh)
    setAck(false)
    setPhase('preview')
  }

  const goToPreview = () => {
    setTouched(true)
    const valor = parseDecimalInput(valorText)
    if (error || valor === null) {
      valueRef.current?.focus()
      return
    }
    setNotice(null)
    setApplyError(null)
    setFilter('todos')
    void loadPreview({ modo, signo, valor, redondeo })
  }

  /** Títulos de los productos con problemas (para el mensaje), resueltos con los datos de la vista previa */
  const affectedTitles = (problems: PriceProblem[]) => {
    const titles = new Map<number, string>()
    for (const p of data) titles.set(p.id, p.titulo)
    for (const i of items) if (!titles.has(i.id)) titles.set(i.id, i.titulo)
    const variantOwner = new Map<number, { productId: number; nombre: string }>()
    for (const p of data) for (const v of p.variantes) variantOwner.set(v.id, { productId: p.id, nombre: v.nombre })
    const lines = new Map<string, string>()
    for (const problem of problems) {
      const owner = problem.variant_id !== null ? variantOwner.get(problem.variant_id) : undefined
      const productId = problem.product_id ?? owner?.productId ?? null
      const titulo = productId !== null ? titles.get(productId) : undefined
      const name = titulo ? (owner ? `${titulo} (${owner.nombre})` : titulo) : 'Un producto'
      lines.set(`${name}|${problem.motivo}`, `${name}: ${PROBLEM_LABELS[problem.motivo] ?? 'tiene un problema'}`)
    }
    return [...lines.values()]
  }

  const apply = async () => {
    if (!preview || !config || applyingRef.current) return
    if (preview.items.length === 0 || preview.tooManyRows || (preview.needsSamePriceAck && !ack)) return
    applyingRef.current = true
    setNotice(null)
    setApplyError(null)
    setPhase('applying')
    const { data: result, error: rpcError } = await priceChangeService.applyPriceChangeBulk(preview.items, priceChangeMeta(config))
    applyingRef.current = false

    if (!rpcError && result) {
      if (result.batch_id) {
        onApplied({ batchId: result.batch_id, products: result.products_changed, variants: result.variants_changed })
      } else {
        setPhase('noChanges')
      }
      return
    }

    const err = rpcError as PriceChangeError
    if (err.key === 'PRICE_CHANGED') {
      setNotice(err)
      await loadPreview(config)
      return
    }
    if (err.key === 'OFFER_INVALID' || err.key === 'IN_TRASH' || err.key === 'NOT_FOUND') {
      const affected = affectedTitles(err.problems)
      setApplyError({ error: err, affected })
      await loadPreview(config)
      return
    }
    // 22023, P4094, P4003 y los inesperados: sin reintento automático
    setApplyError({ error: err, affected: [] })
    setPhase('preview')
  }

  const running = phase === 'applying'
  const canApply = !!preview && preview.items.length > 0 && !preview.tooManyRows && (!preview.needsSamePriceAck || ack)
  const modeInfo = MODES.find(m => m.value === modo)!

  const valueLabel = modo === 'porcentaje' ? 'Porcentaje' : modo === 'monto' ? 'Monto' : 'Precio nuevo'

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!running}
      title={`Cambiar precios de ${plural(items.length, 'producto', 'productos')}`}
      size="xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {phase === 'config' && (
            <>
              <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
              <button type="button" onClick={goToPreview} disabled={!!error} className={btnPrimary}>
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
                <Tag className="w-4 h-4" aria-hidden="true" />
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

          {modo !== 'exacto' && (
            <fieldset>
              <legend className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">¿Subir o bajar?</legend>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                {(['subir', 'bajar'] as const).map(s => (
                  <label key={s} className={radioCard(signo === s)}>
                    <input
                      type="radio"
                      name={`${ids}-signo`}
                      value={s}
                      checked={signo === s}
                      onChange={() => setSigno(s)}
                      className="accent-[#185749] dark:accent-[#1CAAA8]"
                    />
                    {s === 'subir' ? 'Subir' : 'Bajar'}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor={`${ids}-valor`} className="block text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
              {valueLabel}
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-white/40 pointer-events-none" aria-hidden="true">
                {modo === 'porcentaje' ? '%' : '$'}
              </span>
              <input
                ref={valueRef}
                id={`${ids}-valor`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={valorText}
                onChange={e => setValorText(e.target.value)}
                onBlur={() => setTouched(true)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goToPreview() } }}
                aria-invalid={showError}
                aria-describedby={`${ids}-valor-help${showError ? ` ${ids}-valor-error` : ''}`}
                placeholder={modo === 'porcentaje' ? '10' : '1.500'}
                className={`w-full min-h-tap sm:min-h-10 pl-8 pr-3 text-sm rounded-lg border bg-transparent text-gray-800 dark:text-white/90 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 ${
                  showError ? 'border-red-500' : 'border-gray-200 dark:border-white/10 focus:border-[#185749] dark:focus:border-[#1CAAA8]'
                }`}
              />
            </div>
            <p id={`${ids}-valor-help`} className="text-xs text-gray-500 dark:text-white/50 mt-1">
              {modo === 'porcentaje'
                ? 'Hasta 1.000% para subir; menos de 100% para bajar. Podés usar coma: 12,5.'
                : 'En pesos. Podés escribir 1.500 o 1500.'}
            </p>
            <p id={`${ids}-valor-error`} role="alert" className="text-xs font-medium text-red-700 dark:text-red-400 mt-1 min-h-4">
              {showError ? error : ''}
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">Redondeo</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg">
              {ROUNDING_OPTIONS.map(r => (
                <label key={r.value} className={radioCard(redondeo === r.value)}>
                  <input
                    type="radio"
                    name={`${ids}-redondeo`}
                    value={r.value}
                    checked={redondeo === r.value}
                    onChange={() => setRedondeo(r.value)}
                    className="accent-[#185749] dark:accent-[#1CAAA8]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-2">
              Al múltiplo más cercano (la mitad redondea hacia arriba). Con "Ninguno", al peso entero.
            </p>
          </fieldset>

          <p className="text-xs text-gray-500 dark:text-white/50">
            Se cambia el precio de cada producto y de todas sus variantes (también las inactivas). El precio anterior y
            las ofertas no se tocan: antes de aplicar vas a ver una vista previa.
          </p>
        </div>
      )}

      {phase === 'loading' && (
        <div ref={loadingRef} tabIndex={-1} role="status" className="outline-none flex items-center gap-2 text-sm text-gray-700 dark:text-white/70 py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Leyendo los precios actuales de {plural(items.length, 'producto', 'productos')}...
        </div>
      )}

      {phase === 'loadError' && loadError && (
        <Alert tone="red" role="alert">
          <p><FriendlyError error={loadError} prefix="No se pudieron leer los precios actuales. " /></p>
        </Alert>
      )}

      {phase === 'applying' && (
        <div role="status" className="flex items-center gap-2 text-sm text-gray-700 dark:text-white/70 py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Aplicando el cambio de precios... No cierres esta ventana.
        </div>
      )}

      {phase === 'noChanges' && (
        <div role="status">
          <Alert tone="info">
            <p>No hubo cambios: los precios ya estaban así.</p>
          </Alert>
        </div>
      )}

      {phase === 'preview' && preview && (
        <div className="space-y-3">
          <div ref={previewTopRef} tabIndex={-1} className="outline-none space-y-3" aria-live="polite">
            {notice && (
              <Alert tone="amber" role="status">
                <p><FriendlyError error={notice} /></p>
                <p>Actualizamos la vista previa con los precios de ahora: revisala y confirmá de nuevo.</p>
              </Alert>
            )}
            {applyError && (
              <Alert tone="red" role="alert">
                <p><FriendlyError error={applyError.error} /></p>
                {applyError.affected.length > 0 && (
                  <>
                    <p>Productos afectados (la vista previa ya se actualizó con los datos de ahora):</p>
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
                <dd className="font-semibold text-gray-800 dark:text-white/90">
                  {plural(preview.counts.productosModificados, 'producto', 'productos')}
                  <span className="font-normal text-gray-500 dark:text-white/50"> · {plural(preview.counts.variantesModificadas, 'variante', 'variantes')}</span>
                </dd>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
                <dt className="text-xs text-gray-500 dark:text-white/50">Sin cambio</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">{plural(preview.counts.sinCambio, 'producto', 'productos')}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
                <dt className="text-xs text-gray-500 dark:text-white/50">Excluidos (se ajustan a mano)</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">{plural(preview.counts.excluidos, 'producto', 'productos')}</dd>
              </div>
            </dl>
          </div>

          {preview.tooManyRows && (
            <Alert tone="red" role="alert">
              <p>
                Seleccionaste demasiados productos para un solo cambio: el máximo es {MAX_ROWS_PER_CHANGE} filas entre
                productos y variantes; hoy elegiste {preview.rowCount.toLocaleString('es-AR')}. Elegí menos productos.
              </p>
            </Alert>
          )}
          {!preview.tooManyRows && preview.items.length === 0 && (
            <Alert tone="info"><p>No hay precios para modificar con esta configuración.</p></Alert>
          )}
          {preview.products.some(p => p.grande && p.status === 'modificado') && (
            <Alert tone="amber">
              <p>
                Hay cambios grandes (más de {BIG_CHANGE_PCT}%). Revisalos antes de confirmar; no bloquean el cambio.
              </p>
            </Alert>
          )}
          {preview.needsSamePriceAck && !preview.tooManyRows && (
            <Alert tone="amber">
              <p>Algunos productos tienen variantes con precios distintos: con precio exacto van a quedar todas iguales.</p>
              <label className="flex items-start gap-2 min-h-tap sm:min-h-0 py-1 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={e => setAck(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#185749] dark:accent-[#1CAAA8]"
                />
                Entiendo que esas variantes van a quedar todas al mismo precio
              </label>
            </Alert>
          )}
          {preview.products.some(p => p.variantes.length > 0) && (
            <p className="text-xs text-gray-500 dark:text-white/50">
              En productos con variantes, el "Precio base" solo se usa si el producto se vende con la opción base.
            </p>
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

          <PriceChangePreview preview={preview} filter={filter} />
        </div>
      )}
    </Modal>
  )
}
