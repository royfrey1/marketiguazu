import { useCallback, useMemo, useRef, useState } from 'react'

export type SelectionState = 'all' | 'some' | 'none'

interface ToggleOptions<K> {
  /** Shift+click: marca/desmarca el rango entre el último tocado y este, dentro de orderedIds */
  shiftKey?: boolean
  /** Ids en el orden en que se ven (para el rango) */
  orderedIds?: readonly K[]
}

/**
 * Selección de filas por id para acciones masivas (genérica: productos, inventario, etc.).
 * resetKey: cuando cambia (pestaña, filtros, búsqueda) la selección se vacía sola, para no operar
 * sobre filas que ya no se ven. Paginar no la cambia: la selección sigue entre páginas.
 */
export function useRowSelection<K extends string | number>(resetKey: string) {
  const [state, setState] = useState<{ key: string; ids: ReadonlySet<K> }>(() => ({ key: resetKey, ids: new Set() }))
  // Último id tocado sin Shift: ancla del rango
  const anchorRef = useRef<{ key: string; id: K } | null>(null)

  // Con otra clave de contexto la selección anterior ya no vale: se vacía en el mismo render (patrón
  // "ajustar el estado cuando cambia una prop"), así no reaparece si se vuelve a la clave anterior
  if (state.key !== resetKey) setState({ key: resetKey, ids: new Set() })
  const selected = useMemo<ReadonlySet<K>>(
    () => (state.key === resetKey ? state.ids : new Set()),
    [state, resetKey]
  )

  const update = useCallback((fn: (prev: ReadonlySet<K>) => Set<K>) => {
    setState(s => ({ key: resetKey, ids: fn(s.key === resetKey ? s.ids : new Set()) }))
  }, [resetKey])

  const toggle = useCallback((id: K, options: ToggleOptions<K> = {}) => {
    const { shiftKey = false, orderedIds } = options
    const anchor = anchorRef.current?.key === resetKey ? anchorRef.current.id : null
    if (shiftKey && orderedIds && anchor !== null && anchor !== id) {
      const from = orderedIds.indexOf(anchor)
      const to = orderedIds.indexOf(id)
      if (from !== -1 && to !== -1) {
        const range = orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1)
        update(prev => {
          // El rango toma el estado nuevo del id tocado
          const select = !prev.has(id)
          const next = new Set(prev)
          for (const r of range) {
            if (select) next.add(r)
            else next.delete(r)
          }
          return next
        })
        anchorRef.current = { key: resetKey, id }
        return
      }
    }
    anchorRef.current = { key: resetKey, id }
    update(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [resetKey, update])

  /** Checkbox de cabecera: si están todos, los quita; si no, los agrega */
  const toggleMany = useCallback((ids: readonly K[]) => {
    update(prev => {
      const next = new Set(prev)
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
      for (const id of ids) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }, [update])

  /** Agrega ids a la selección (por ejemplo, todos los de la lista y no solo los de la página) */
  const selectAll = useCallback((ids: readonly K[]) => {
    update(prev => new Set([...prev, ...ids]))
  }, [update])

  /** Saca ids de la selección (por ejemplo, los que ya se procesaron con éxito) */
  const deselect = useCallback((ids: readonly K[]) => {
    update(prev => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }, [update])

  const clear = useCallback(() => {
    anchorRef.current = null
    update(() => new Set())
  }, [update])

  const isSelected = useCallback((id: K) => selected.has(id), [selected])

  /** Estado del checkbox de cabecera para las filas visibles */
  const stateOf = useCallback((ids: readonly K[]): SelectionState => {
    const n = ids.filter(id => selected.has(id)).length
    return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
  }, [selected])

  return { selected, count: selected.size, toggle, toggleMany, selectAll, deselect, clear, isSelected, stateOf }
}
