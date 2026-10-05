import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface VariantOptionState {
  val: string
  isSelected: boolean
  isCompatible: boolean
  isAvailable: boolean
}

interface VariantDropdownProps {
  label: string
  options: VariantOptionState[]
  value: string | undefined
  onSelect: (value: string) => void
}

function isSelectable(opt: VariantOptionState) {
  return opt.isCompatible && opt.isAvailable
}

function StockBadge({ opt }: { opt: VariantOptionState }) {
  if (!opt.isCompatible) {
    return (
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        No disponible
      </span>
    )
  }
  if (!opt.isAvailable) {
    return (
      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-500">
        Sin stock
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-primary-light/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      Disponible
    </span>
  )
}

/**
 * Selector de variante (listbox accesible) que muestra el estado de stock de
 * cada opción. Las opciones incompatibles o sin stock no son seleccionables.
 */
export default function VariantDropdown({ label, options, value, onSelect }: VariantDropdownProps) {
  const baseId = useId()
  const labelId = `${baseId}-label`
  const listboxId = `${baseId}-listbox`
  const optionId = (index: number) => `${baseId}-option-${index}`

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find(o => o.val === value)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex])

  const findSelectable = (from: number, step: 1 | -1) => {
    for (let i = from; i >= 0 && i < options.length; i += step) {
      if (isSelectable(options[i])) return i
    }
    return -1
  }

  const openList = () => {
    const selectedIndex = options.findIndex(o => o.val === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : findSelectable(0, 1))
    setOpen(true)
  }

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const choose = (index: number) => {
    const opt = options[index]
    if (!opt || !isSelectable(opt)) return
    // handleAttributeSelect alterna: volver a elegir el valor actual lo deseleccionaría
    if (opt.val !== value) onSelect(opt.val)
    close(true)
  }

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openList()
    }
  }

  const handleListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const next = findSelectable(activeIndex + 1, 1)
        if (next >= 0) setActiveIndex(next)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prev = findSelectable(activeIndex - 1, -1)
        if (prev >= 0) setActiveIndex(prev)
        break
      }
      case 'Home': {
        e.preventDefault()
        const first = findSelectable(0, 1)
        if (first >= 0) setActiveIndex(first)
        break
      }
      case 'End': {
        e.preventDefault()
        const last = findSelectable(options.length - 1, -1)
        if (last >= 0) setActiveIndex(last)
        break
      }
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div ref={rootRef} className="relative w-full lg:max-w-xs">
      <span id={labelId} className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={`${labelId} ${baseId}-value`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full flex items-center justify-between gap-3 border rounded-lg px-3 py-2.5 text-sm bg-white cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open ? 'border-accent' : 'border-gray-200 hover:border-accent'
        }`}
      >
        <span id={`${baseId}-value`} className={`flex-1 min-w-0 truncate text-left ${selectedOption ? 'text-primary-dark font-medium' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.val : `Seleccioná ${label}`}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {selectedOption && !isSelectable(selectedOption) && <StockBadge opt={selectedOption} />}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onKeyDown={handleListKeyDown}
          // Al menos tan ancho como el trigger, pero puede crecer según el contenido
          // (en desktop el trigger es angosto porque comparte fila con "Cantidad").
          className="absolute left-0 min-w-full w-max max-w-[calc(100vw-2rem)] z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none"
        >
          {options.map((opt, index) => {
            const selectable = isSelectable(opt)
            const isActive = index === activeIndex
            return (
              <li
                key={opt.val}
                id={optionId(index)}
                role="option"
                aria-selected={opt.isSelected}
                aria-disabled={!selectable}
                onClick={() => choose(index)}
                onPointerMove={() => selectable && setActiveIndex(index)}
                className={`flex items-start sm:items-center gap-2 px-3 py-2.5 text-sm ${
                  selectable ? 'cursor-pointer text-primary-dark' : 'cursor-not-allowed text-gray-300'
                } ${isActive && selectable ? 'bg-primary-light/30' : ''}`}
              >
                <Check
                  className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-primary ${opt.isSelected ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden="true"
                />
                {/* Mobile: nombre completo y badge debajo. sm+: misma fila, nombre truncado si no entra. */}
                <span className="flex-1 min-w-0 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className={`max-w-full break-words sm:truncate ${opt.isSelected ? 'font-semibold' : ''}`}>{opt.val}</span>
                  <StockBadge opt={opt} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
