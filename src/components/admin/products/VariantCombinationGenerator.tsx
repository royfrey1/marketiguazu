import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Plus, Trash2, X, XCircle } from 'lucide-react'
import {
  productVariantsService,
  type VariantWithInventory,
} from '../../../services/productVariants.service'
import { productsService } from '../../../services/products.service'
import { sanitizeAttributeName } from '../../../lib/variantAttributes'
import Modal from '../../ui/Modal'

interface VariantCombinationGeneratorProps {
  productId: number
  existingVariants: VariantWithInventory[]
  /** created = true si se creó al menos una variante (el padre refresca la lista). */
  onClose: (created: boolean) => void
}

interface AttributeDraft {
  id: number
  name: string
  values: string[]
  pendingValue: string
}

interface CombinationRow {
  key: string
  atributos: Record<string, string>
  sku: string
  nombre: string
  precio: string
  include: boolean
}

interface CreationResult {
  row: CombinationRow
  error: string | null
}

type Step = 'define' | 'preview' | 'creating' | 'done'

const MAX_COMBINATIONS = 100

const inputClasses = "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
const cellInputClasses = "w-full min-w-0 px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs border rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20"
const primaryButtonClasses = "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer bg-[#185749] text-white hover:bg-[#0D3732] dark:bg-[#1CAAA8] dark:hover:bg-[#1CAAA8]/90 disabled:bg-gray-100 dark:disabled:bg-white/5 disabled:text-gray-400 dark:disabled:text-white/20 disabled:cursor-not-allowed"
const secondaryButtonClasses = "flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80 cursor-pointer disabled:opacity-50"

function normalizeToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/** "Azul Marino" → "AM", "Negro" → "NEG", "256GB" → "256GB", "1 TB" → "1TB" */
function abbreviateValue(value: string) {
  const words = normalizeToken(value).split(' ').filter(Boolean)
  if (words.length === 0) return ''
  if (words.some(w => /\d/.test(w))) return words.join('')
  if (words.length > 1) return words.map(w => w[0]).join('')
  return words[0].slice(0, 3)
}

function buildSkuBase(slug: string | null | undefined) {
  return normalizeToken(slug ?? '').replace(/ /g, '-').slice(0, 20) || 'VAR'
}

function cartesian(attributes: { name: string; values: string[] }[]): Record<string, string>[] {
  return attributes.reduce<Record<string, string>[]>(
    (acc, attr) => acc.flatMap(combo => attr.values.map(val => ({ ...combo, [attr.name]: val }))),
    [{}],
  )
}

function combinationKey(atributos: Record<string, string>) {
  return JSON.stringify(Object.entries(atributos).sort(([a], [b]) => a.localeCompare(b)))
}

function describeError(err: { message?: string; code?: string } | null) {
  if (!err) return 'Error desconocido'
  if (err.code === '23505') return 'El SKU ya existe'
  return err.message || 'Error desconocido'
}

let nextAttributeId = 1
const emptyAttribute = (): AttributeDraft => ({ id: nextAttributeId++, name: '', values: [], pendingValue: '' })

export default function VariantCombinationGenerator({ productId, existingVariants, onClose }: VariantCombinationGeneratorProps) {
  const [step, setStep] = useState<Step>('define')
  const [attributes, setAttributes] = useState<AttributeDraft[]>(() => [emptyAttribute()])
  const [rows, setRows] = useState<CombinationRow[]>([])
  const [skuBase, setSkuBase] = useState('VAR')
  const [basePrice, setBasePrice] = useState('')
  const [bulkPrice, setBulkPrice] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<CreationResult[]>([])
  const abortRef = useRef(false)
  const createdAnyRef = useRef(false)

  // SKU base y precio sugerido a partir del producto
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await productsService.getById(productId)
      if (cancelled || !data) return
      setSkuBase(buildSkuBase(data.slug))
      if (data.precio > 0) setBasePrice(String(data.precio))
    }
    load()
    return () => { cancelled = true }
  }, [productId])

  const existingKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const v of existingVariants) {
      if (v.atributos && typeof v.atributos === 'object') {
        keys.add(combinationKey(v.atributos as Record<string, string>))
      }
    }
    return keys
  }, [existingVariants])

  const existingSkus = useMemo(
    () => new Set(existingVariants.map(v => v.sku.trim().toUpperCase())),
    [existingVariants],
  )

  const existingAttributeNames = useMemo(() => {
    const names = new Set<string>()
    for (const v of existingVariants) {
      if (v.atributos && typeof v.atributos === 'object') {
        Object.keys(v.atributos).forEach(k => names.add(k))
      }
    }
    return [...names]
  }, [existingVariants])

  // ── Paso 1: atributos ────────────────────────────────────────────────

  const updateAttribute = (id: number, patch: Partial<AttributeDraft>) => {
    setAttributes(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)))
  }

  const addValues = (attr: AttributeDraft) => {
    // Permite pegar varios valores separados por coma
    const incoming = attr.pendingValue.split(',').map(v => v.trim()).filter(Boolean)
    const values = [...attr.values]
    for (const val of incoming) {
      if (!values.some(v => v.toLowerCase() === val.toLowerCase())) values.push(val)
    }
    updateAttribute(attr.id, { values, pendingValue: '' })
  }

  const handleValueKeyDown = (e: KeyboardEvent<HTMLInputElement>, attr: AttributeDraft) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addValues(attr)
    } else if (e.key === 'Backspace' && !attr.pendingValue && attr.values.length > 0) {
      updateAttribute(attr.id, { values: attr.values.slice(0, -1) })
    }
  }

  const validAttributes = attributes
    .map(a => ({ name: sanitizeAttributeName(a.name), values: a.values }))
    .filter(a => a.name && a.values.length > 0)

  const attributeNameCounts = new Map<string, number>()
  for (const a of attributes) {
    const n = sanitizeAttributeName(a.name).toLowerCase()
    if (n) attributeNameCounts.set(n, (attributeNameCounts.get(n) ?? 0) + 1)
  }
  const hasDuplicateNames = [...attributeNameCounts.values()].some(c => c > 1)
  const hasIncompleteAttribute = attributes.some(a => (sanitizeAttributeName(a.name) === '') !== (a.values.length === 0))
  const combinationCount = validAttributes.length > 0
    ? validAttributes.reduce((n, a) => n * a.values.length, 1)
    : 0
  const canGoToPreview = combinationCount > 0
    && combinationCount <= MAX_COMBINATIONS
    && !hasDuplicateNames
    && !hasIncompleteAttribute

  const goToPreview = () => {
    // Conserva las ediciones previas si se vuelve atrás y se agregan/quitan valores
    const previous = new Map(rows.map(r => [r.key, r]))
    const next = cartesian(validAttributes).map(atributos => {
      const key = combinationKey(atributos)
      const prev = previous.get(key)
      if (prev) return prev
      const values = Object.values(atributos)
      const alreadyExists = existingKeys.has(key)
      return {
        key,
        atributos,
        sku: [skuBase, ...values.map(abbreviateValue).filter(Boolean)].join('-'),
        nombre: values.join(' '),
        precio: basePrice,
        include: !alreadyExists,
      }
    })
    setRows(next)
    setStep('preview')
  }

  // ── Paso 2: previsualización ────────────────────────────────────────

  const updateRow = (key: string, patch: Partial<CombinationRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  const applyBulkPrice = () => {
    if (bulkPrice === '' || Number(bulkPrice) < 0) return
    setRows(prev => prev.map(r => ({ ...r, precio: bulkPrice })))
  }

  const includedRows = rows.filter(r => r.include)
  const allIncluded = rows.length > 0 && includedRows.length === rows.length

  const skuCounts = new Map<string, number>()
  for (const r of includedRows) {
    const s = r.sku.trim().toUpperCase()
    if (s) skuCounts.set(s, (skuCounts.get(s) ?? 0) + 1)
  }

  const rowErrors = new Map<string, { sku?: string; nombre?: string; precio?: string }>()
  for (const r of includedRows) {
    const errs: { sku?: string; nombre?: string; precio?: string } = {}
    const sku = r.sku.trim().toUpperCase()
    if (!sku) errs.sku = 'Requerido'
    else if ((skuCounts.get(sku) ?? 0) > 1) errs.sku = 'SKU repetido'
    else if (existingSkus.has(sku)) errs.sku = 'Ya existe en otra variante'
    if (!r.nombre.trim()) errs.nombre = 'Requerido'
    if (r.precio === '' || Number.isNaN(Number(r.precio)) || Number(r.precio) < 0) errs.precio = 'Precio inválido'
    if (Object.keys(errs).length > 0) rowErrors.set(r.key, errs)
  }

  const canCreate = includedRows.length > 0 && rowErrors.size === 0
  const mismatchedExistingNames = existingAttributeNames.length > 0
    && (existingAttributeNames.length !== validAttributes.length
      || !existingAttributeNames.every(n => validAttributes.some(a => a.name === n)))

  // ── Paso 3: creación ────────────────────────────────────────────────

  const handleCreate = async () => {
    const toCreate = includedRows
    abortRef.current = false
    setResults([])
    setProgress({ current: 0, total: toCreate.length })
    setStep('creating')

    const collected: CreationResult[] = []
    for (let i = 0; i < toCreate.length; i++) {
      if (abortRef.current) break
      setProgress({ current: i + 1, total: toCreate.length })
      const row = toCreate[i]
      try {
        const { error } = await productVariantsService.create(productId, {
          sku: row.sku.trim(),
          nombre: row.nombre.trim(),
          precio: Number(row.precio),
          precio_anterior: null,
          atributos: row.atributos,
          imagen_url: null,
          activo: true,
        })
        if (!error) createdAnyRef.current = true
        collected.push({ row, error: error ? describeError(error) : null })
      } catch (err) {
        collected.push({ row, error: (err as Error).message || 'Error desconocido' })
      }
    }

    if (abortRef.current) {
      // El modal se cerró durante la creación: se corta y se refresca la lista
      onClose(createdAnyRef.current)
      return
    }
    setResults(collected)
    setStep('done')
  }

  const retryFailed = () => {
    const failedKeys = new Set(results.filter(r => r.error).map(r => r.row.key))
    setRows(prev => prev
      .filter(r => !results.some(res => !res.error && res.row.key === r.key))
      .map(r => ({ ...r, include: failedKeys.has(r.key) })))
    setStep('preview')
  }

  const handleModalClose = () => {
    if (step === 'creating') {
      abortRef.current = true
      return
    }
    onClose(createdAnyRef.current)
  }

  const succeeded = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)

  // ── Render ──────────────────────────────────────────────────────────

  const footer = (() => {
    if (step === 'define') {
      return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-white/40">
            {combinationCount > 0 && (
              <>
                <strong className="text-gray-800 dark:text-white/80">{combinationCount}</strong>{' '}
                combinaci{combinationCount === 1 ? 'ón' : 'ones'}
              </>
            )}
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => onClose(false)} className={secondaryButtonClasses}>
              Cancelar
            </button>
            <button type="button" onClick={goToPreview} disabled={!canGoToPreview} className={primaryButtonClasses}>
              Ver combinaciones
            </button>
          </div>
        </div>
      )
    }
    if (step === 'preview') {
      return (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <button type="button" onClick={() => setStep('define')} className={secondaryButtonClasses}>
            <ArrowLeft className="w-4 h-4" /> Atributos
          </button>
          <button type="button" onClick={handleCreate} disabled={!canCreate} className={primaryButtonClasses}>
            Crear {includedRows.length} variante{includedRows.length === 1 ? '' : 's'}
          </button>
        </div>
      )
    }
    if (step === 'done') {
      return (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {failed.length > 0 && (
            <button type="button" onClick={retryFailed} className={secondaryButtonClasses}>
              Corregir y reintentar fallidas
            </button>
          )}
          <button type="button" onClick={() => onClose(createdAnyRef.current)} className={primaryButtonClasses}>
            Cerrar
          </button>
        </div>
      )
    }
    return null
  })()

  return (
    <Modal
      open
      onClose={handleModalClose}
      title="Generar combinaciones"
      description={
        step === 'define' ? 'Paso 1 de 2 · Definí los atributos y sus valores'
          : step === 'preview' ? 'Paso 2 de 2 · Revisá las variantes a crear'
            : undefined
      }
      size="lg"
      className={step === 'preview' || step === 'done' ? 'max-w-4xl!' : ''}
      closeOnOverlay={step !== 'creating'}
      hideCloseButton={step === 'creating'}
      footer={footer}
    >
      {step === 'define' && (
        <div className="space-y-4">
          {attributes.map((attr, index) => {
            const savedName = sanitizeAttributeName(attr.name)
            const duplicated = (attributeNameCounts.get(savedName.toLowerCase()) ?? 0) > 1
            // Se resalta cuando la sanitización cambió algo además de los espacios
            const nameWasCleaned = savedName !== attr.name.trim()
            return (
              <div key={attr.id} className="rounded-lg border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`attr-name-${attr.id}`} className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                      Atributo {index + 1}
                    </label>
                    <input
                      id={`attr-name-${attr.id}`}
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttribute(attr.id, { name: e.target.value })}
                      placeholder="Ej: Color, Capacidad, Talle"
                      className={inputClasses}
                    />
                  </div>
                  {attributes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAttributes(prev => prev.filter(a => a.id !== attr.id))}
                      className="p-2.5 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                      title="Quitar atributo"
                      aria-label={`Quitar atributo ${attr.name || index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {attr.name.trim() && (
                  <p className={`-mt-1.5 text-[11px] ${nameWasCleaned ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-white/30'}`}>
                    Se guardará como:{' '}
                    {savedName
                      ? <span className="font-mono font-medium">{savedName}</span>
                      : <span className="italic">(vacío)</span>}
                  </p>
                )}
                {duplicated && (
                  <p className="text-xs text-red-600 dark:text-red-400">Ya hay otro atributo con este nombre.</p>
                )}

                <div>
                  <label htmlFor={`attr-value-${attr.id}`} className="block text-xs font-medium text-gray-500 dark:text-white/40 mb-1.5">
                    Valores
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 focus-within:border-[#185749] dark:focus-within:border-[#1CAAA8] focus-within:ring-2 focus-within:ring-[#185749]/20 dark:focus-within:ring-[#1CAAA8]/20 transition-colors">
                    {attr.values.map(val => (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1 rounded-md bg-[#185749]/10 dark:bg-[#1CAAA8]/10 px-2 py-1 text-xs font-medium text-[#185749] dark:text-[#1CAAA8]"
                      >
                        {val}
                        <button
                          type="button"
                          onClick={() => updateAttribute(attr.id, { values: attr.values.filter(v => v !== val) })}
                          className="hover:text-red-500 cursor-pointer"
                          aria-label={`Quitar ${val}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      id={`attr-value-${attr.id}`}
                      type="text"
                      value={attr.pendingValue}
                      onChange={(e) => updateAttribute(attr.id, { pendingValue: e.target.value })}
                      onKeyDown={(e) => handleValueKeyDown(e, attr)}
                      onBlur={() => attr.pendingValue.trim() && addValues(attr)}
                      placeholder={attr.values.length === 0 ? 'Ej: Negro' : 'Agregar valor...'}
                      className="flex-1 min-w-[6rem] bg-transparent px-1 py-1 text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-white/25 mt-1">
                    Enter o coma para agregar. Podés pegar varios separados por coma.
                  </p>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => setAttributes(prev => [...prev, emptyAttribute()])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#185749] dark:text-[#1CAAA8] bg-[#185749]/5 dark:bg-[#1CAAA8]/5 hover:bg-[#185749]/10 dark:hover:bg-[#1CAAA8]/10 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar atributo
          </button>

          {hasIncompleteAttribute && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Cada atributo necesita un nombre y al menos un valor.
            </p>
          )}
          {combinationCount > MAX_COMBINATIONS && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {combinationCount} combinaciones superan el máximo de {MAX_COMBINATIONS}. Reducí la cantidad de valores.
            </p>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          {mismatchedExistingNames && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Las variantes existentes usan los atributos <strong>{existingAttributeNames.join(', ')}</strong>.
                Si los nombres no coinciden con los de acá, la tienda los va a mostrar como selectores distintos.
              </p>
            </div>
          )}

          {/* Precio para todas */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="sm:w-48">
              <label htmlFor="bulk-price" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                Precio para todas
              </label>
              <input
                id="bulk-price"
                type="number"
                min="0"
                step="0.01"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyBulkPrice() } }}
                placeholder={basePrice || '0'}
                className={inputClasses}
              />
            </div>
            <button
              type="button"
              onClick={applyBulkPrice}
              disabled={bulkPrice === '' || Number(bulkPrice) < 0}
              className="px-3 py-2.5 text-xs font-medium text-[#185749] dark:text-[#1CAAA8] bg-[#185749]/5 dark:bg-[#1CAAA8]/5 hover:bg-[#185749]/10 dark:hover:bg-[#1CAAA8]/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aplicar a todas
            </button>
            <p className="text-xs text-gray-400 dark:text-white/30 sm:ml-auto sm:self-center">
              {includedRows.length} de {rows.length} seleccionadas
            </p>
          </div>

          {/* Tabla */}
          <div className="rounded-lg border border-gray-200 dark:border-white/10">
            {/* Encabezado: en mobile solo "seleccionar todas"; en desktop, columnas de la tabla */}
            <div className="grid grid-cols-[28px_minmax(0,1fr)] sm:grid-cols-[28px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_110px] gap-2 px-3 py-2 text-[11px] font-medium text-gray-400 dark:text-white/25 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 items-center">
              <input
                id="combo-select-all"
                type="checkbox"
                checked={allIncluded}
                onChange={(e) => setRows(prev => prev.map(r => ({ ...r, include: e.target.checked })))}
                className="rounded border-gray-300 dark:border-white/20"
                aria-label="Seleccionar todas las combinaciones"
              />
              <label htmlFor="combo-select-all" className="sm:hidden cursor-pointer">Seleccionar todas</label>
              <span className="hidden sm:block">Combinación</span>
              <span className="hidden sm:block">SKU</span>
              <span className="hidden sm:block">Nombre</span>
              <span className="hidden sm:block">Precio</span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((row, index) => {
                const errs = rowErrors.get(row.key)
                const label = Object.values(row.atributos).join(' · ')
                const alreadyExists = existingKeys.has(row.key)
                const errorBorder = 'border-red-300 dark:border-red-500/50'
                const okBorder = 'border-gray-200 dark:border-white/10'
                const fieldId = (field: string) => `combo-${index}-${field}`
                const mobileLabelClasses = 'sm:hidden block text-[11px] font-medium text-gray-500 dark:text-white/40 mb-1'
                return (
                  // Mobile: tarjeta (checkbox + combinación arriba, campos apilados a todo el ancho).
                  // Desktop (sm+): fila de tabla de 5 columnas.
                  <div
                    key={row.key}
                    className={`grid grid-cols-[28px_minmax(0,1fr)] sm:grid-cols-[28px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_110px] gap-x-2 gap-y-3 sm:gap-y-2 px-3 py-3 sm:py-2.5 sm:items-start ${row.include ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                      className="mt-1 sm:mt-1.5 rounded border-gray-300 dark:border-white/20"
                      aria-label={`Crear la combinación ${label}`}
                    />
                    <div className="min-w-0 sm:pt-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/80 break-words sm:truncate">{label}</p>
                      {alreadyExists && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">Ya existe esta combinación</p>
                      )}
                    </div>

                    <div className="col-span-2 sm:col-span-1 min-w-0">
                      <label htmlFor={fieldId('sku')} className={mobileLabelClasses}>SKU</label>
                      <input
                        id={fieldId('sku')}
                        type="text"
                        value={row.sku}
                        onChange={(e) => updateRow(row.key, { sku: e.target.value })}
                        disabled={!row.include}
                        aria-label={`SKU de ${label}`}
                        placeholder="SKU"
                        className={`${cellInputClasses} font-mono ${row.include && errs?.sku ? errorBorder : okBorder}`}
                      />
                      {row.include && errs?.sku && <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">{errs.sku}</p>}
                    </div>

                    <div className="col-span-2 sm:col-span-1 min-w-0">
                      <label htmlFor={fieldId('nombre')} className={mobileLabelClasses}>Nombre</label>
                      <input
                        id={fieldId('nombre')}
                        type="text"
                        value={row.nombre}
                        onChange={(e) => updateRow(row.key, { nombre: e.target.value })}
                        disabled={!row.include}
                        aria-label={`Nombre de ${label}`}
                        placeholder="Nombre"
                        className={`${cellInputClasses} ${row.include && errs?.nombre ? errorBorder : okBorder}`}
                      />
                      {row.include && errs?.nombre && <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">{errs.nombre}</p>}
                    </div>

                    <div className="col-span-2 sm:col-span-1 min-w-0">
                      <label htmlFor={fieldId('precio')} className={mobileLabelClasses}>Precio</label>
                      <input
                        id={fieldId('precio')}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.precio}
                        onChange={(e) => updateRow(row.key, { precio: e.target.value })}
                        disabled={!row.include}
                        aria-label={`Precio de ${label}`}
                        placeholder="Precio"
                        className={`${cellInputClasses} ${row.include && errs?.precio ? errorBorder : okBorder}`}
                      />
                      {row.include && errs?.precio && <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">{errs.precio}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-white/30">
            Las variantes se crean activas y sin stock. El stock se carga después desde Inventario.
          </p>
        </div>
      )}

      {step === 'creating' && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-6 h-6 text-[#185749] dark:text-[#1CAAA8] animate-spin" />
          <p className="text-sm font-medium text-gray-700 dark:text-white/70" aria-live="polite">
            Creando {progress.current} de {progress.total}...
          </p>
          <div className="w-full max-w-xs h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
            <div
              className="h-full bg-[#185749] dark:bg-[#1CAAA8] transition-all"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <CheckCircle2 className="w-5 h-5 text-[#389C52] shrink-0" />
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-white/80">{succeeded.length}</p>
                <p className="text-xs text-gray-500 dark:text-white/40">creada{succeeded.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <XCircle className={`w-5 h-5 shrink-0 ${failed.length > 0 ? 'text-red-500' : 'text-gray-300 dark:text-white/20'}`} />
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-white/80">{failed.length}</p>
                <p className="text-xs text-gray-500 dark:text-white/40">fallida{failed.length === 1 ? '' : 's'}</p>
              </div>
            </div>
          </div>

          {failed.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg divide-y divide-red-100 dark:divide-red-800/30">
              {failed.map(({ row, error }) => (
                <div key={row.key} className="px-3 py-2">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">
                    {row.nombre} <span className="font-mono break-all text-red-600 dark:text-red-400">({row.sku})</span>
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
