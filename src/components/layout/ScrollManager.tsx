import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Contenedores con scroll propio (por ejemplo el <main> del admin): se resetean y restauran junto con la ventana
const CONTAINER_SELECTOR = '[data-scroll-container]'
const STORAGE_KEY = 'scroll-positions'
// Al volver atrás, la página puede tardar en tener su alto final (lazy + datos): se reintenta hasta este tiempo
const RESTORE_TIMEOUT_MS = 1000
const RESTORE_STEP_MS = 50

interface SavedPosition {
  y: number
  containers: number[]
}

function readSaved(): Map<string, SavedPosition> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return new Map(raw ? (JSON.parse(raw) as [string, SavedPosition][]) : [])
  } catch {
    return new Map()
  }
}

function writeSaved(map: Map<string, SavedPosition>) {
  try {
    // Solo las últimas entradas: alcanza para atrás/adelante y no crece sin límite
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...map].slice(-50)))
  } catch {
    // sessionStorage no disponible: la restauración queda solo en memoria
  }
}

function containers(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR)]
}

function scrollAllTo(y: number, containerTops: number[] = []) {
  // 'instant' explícito: ignora cualquier scroll-behavior: smooth del CSS
  window.scrollTo({ top: y, left: 0, behavior: 'instant' })
  containers().forEach((el, i) => { el.scrollTop = containerTops[i] ?? 0 })
}

// Cambio solo de query en la misma ruta: la paginación lleva arriba; filtros y orden no mueven el scroll
function onlyPageChanged(prevSearch: string, nextSearch: string): boolean {
  const prev = new URLSearchParams(prevSearch)
  const next = new URLSearchParams(nextSearch)
  if ((prev.get('page') ?? '1') === (next.get('page') ?? '1')) return false
  prev.delete('page')
  next.delete('page')
  prev.sort()
  next.sort()
  return prev.toString() === next.toString()
}

function findHashTarget(hash: string): HTMLElement | null {
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    // Hash mal codificado: no hay destino
    return null
  }
}

function scrollToHash(hash: string): boolean {
  const el = findHashTarget(hash)
  if (!el) return false
  // Que el header sticky no tape el destino
  const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerHeight - 8, left: 0, behavior: 'instant' })
  return true
}

/**
 * Manejo del scroll al navegar (BrowserRouter no lo hace):
 * - Ruta nueva (link, navigate o redirección): arriba de todo.
 * - Atrás/adelante: se restaura la posición que tenía esa entrada del historial.
 * - Misma ruta con otra query: solo el cambio de página de resultados lleva arriba.
 * - Con #ancla: al elemento, si existe.
 */
export default function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const savedRef = useRef<Map<string, SavedPosition> | null>(null)
  const currentKeyRef = useRef(location.key)
  const prevRef = useRef<{ pathname: string; search: string } | null>(null)

  // El navegador no debe restaurar por su cuenta: lo hace este componente
  useEffect(() => {
    if (!('scrollRestoration' in history)) return
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => { history.scrollRestoration = previous }
  }, [])

  // Guarda la posición de la entrada actual mientras se scrollea (ventana y contenedores)
  useEffect(() => {
    if (!savedRef.current) savedRef.current = readSaved()
    const save = () => {
      savedRef.current?.set(currentKeyRef.current, { y: window.scrollY, containers: containers().map(el => el.scrollTop) })
    }
    const persist = () => { if (savedRef.current) writeSaved(savedRef.current) }
    document.addEventListener('scroll', save, { capture: true, passive: true })
    window.addEventListener('pagehide', persist)
    return () => {
      document.removeEventListener('scroll', save, { capture: true })
      window.removeEventListener('pagehide', persist)
    }
  }, [])

  useLayoutEffect(() => {
    if (!savedRef.current) savedRef.current = readSaved()
    const saved = savedRef.current
    const prev = prevRef.current
    prevRef.current = { pathname: location.pathname, search: location.search }
    currentKeyRef.current = location.key
    writeSaved(saved)

    const samePath = prev?.pathname === location.pathname
    let restoreTimer: ReturnType<typeof setTimeout> | null = null

    if (navigationType === 'POP') {
      const target = saved.get(location.key)
      if (!target) {
        if (!samePath) scrollAllTo(0)
      } else {
        // Reintenta mientras la página todavía no tenga alto suficiente, sin pasar de RESTORE_TIMEOUT_MS
        const started = Date.now()
        const attempt = () => {
          scrollAllTo(target.y, target.containers)
          const reached = Math.abs(window.scrollY - target.y) < 2
          if (!reached && Date.now() - started < RESTORE_TIMEOUT_MS) {
            restoreTimer = setTimeout(attempt, RESTORE_STEP_MS)
          }
        }
        attempt()
      }
    } else if (location.hash) {
      const started = Date.now()
      const attempt = () => {
        if (scrollToHash(location.hash)) return
        if (Date.now() - started < RESTORE_TIMEOUT_MS) restoreTimer = setTimeout(attempt, RESTORE_STEP_MS)
        else if (!samePath) scrollAllTo(0)
      }
      attempt()
    } else if (!samePath || (prev && onlyPageChanged(prev.search, location.search))) {
      scrollAllTo(0)
    }

    return () => {
      if (restoreTimer) clearTimeout(restoreTimer)
    }
  }, [location.key, location.pathname, location.search, location.hash, navigationType])

  return null
}
