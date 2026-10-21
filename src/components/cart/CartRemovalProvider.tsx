import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { sileo } from 'sileo'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import useCart from '../../hooks/useCart'
import useAuth from '../../hooks/useAuth'
import { cartService } from '../../services/cart.service'
import { cartItemImage, cartItemOptionLabel } from '../../lib/cartItemDisplay'
import type { CartItemWithProduct } from '../../types/cart'
import { CartRemovalContext, type CartRemovalContextType } from './CartRemovalContext'

/** Preferencia "No mostrar este mensaje otra vez" (por dispositivo) */
const SKIP_CONFIRM_KEY = 'iguazu_cart_skip_remove_confirm'
/** Cuánto se puede deshacer una eliminación */
const UNDO_WINDOW_MS = 10_000
/** Cuánto se ve el aviso con "Deshacer" */
const UNDO_TOAST_MS = 7_000
const MAX_UNDO_BUFFER = 5

interface RemovedLine {
  key: number
  productId: number
  variantId: number | null
  cantidad: number
  precioUnitario: number
  nombre: string
  removedAt: number
}

function readSkipConfirm(): boolean {
  try {
    return localStorage.getItem(SKIP_CONFIRM_KEY) === '1'
  } catch {
    return false
  }
}

function saveSkipConfirm() {
  try {
    localStorage.setItem(SKIP_CONFIRM_KEY, '1')
  } catch {
    // Sin almacenamiento el modal se sigue mostrando
  }
}

function lineName(item: CartItemWithProduct): string {
  const label = cartItemOptionLabel(item)
  const titulo = item.products?.titulo ?? 'Producto'
  return label ? `${titulo} - ${label}` : titulo
}

// La línea quitada desaparece (y durante la carga, toda la lista): el foco va al título del carrito
function focusCartHeading() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[data-cart-heading]')?.focus()
  }))
}

/**
 * Quitar líneas del carrito: modal de confirmación, preferencia "no mostrar otra vez" y "Deshacer".
 * Guarda en memoria las últimas eliminaciones (hasta 5, 10 s cada una); al salir del carrito se descartan.
 */
export default function CartRemovalProvider({ children }: { children: ReactNode }) {
  const { items, removeItem, addToCart } = useCart()
  const { user } = useAuth()
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const [pending, setPending] = useState<CartItemWithProduct | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)
  const confirmedRef = useRef(false)

  const bufferRef = useRef<RemovedLine[]>([])
  // Eliminaciones ya restauradas (o en curso): un segundo toque en "Deshacer" no hace nada
  const consumedRef = useRef(new Set<number>())
  const keyRef = useRef(0)
  const toastRef = useRef<{ id: string; at: number } | null>(null)
  // El botón del aviso llama siempre a la versión actual de undo (definida más abajo)
  const undoRef = useRef<(key: number) => Promise<void>>(async () => {})

  const pruneBuffer = () => {
    const now = Date.now()
    bufferRef.current = bufferRef.current.filter(e => now - e.removedAt < UNDO_WINDOW_MS)
  }

  // Al salir del carrito: se descartan las eliminaciones y se cierra el aviso si todavía es el nuestro
  useEffect(() => () => {
    bufferRef.current = []
    const toast = toastRef.current
    if (toast && Date.now() - toast.at < UNDO_TOAST_MS) sileo.dismiss(toast.id)
  }, [])

  const showUndoToast = useCallback((title: string, entry: RemovedLine, description: string) => {
    const remaining = UNDO_WINDOW_MS - (Date.now() - entry.removedAt)
    const id = sileo.action({
      title,
      description,
      duration: Math.max(1_000, Math.min(UNDO_TOAST_MS, remaining)),
      button: { title: 'Deshacer', onClick: () => void undoRef.current(entry.key) },
    })
    toastRef.current = { id, at: Date.now() }
  }, [])

  const undo = useCallback(async (key: number) => {
    if (consumedRef.current.has(key)) return
    pruneBuffer()
    const entry = bufferRef.current.find(e => e.key === key)
    if (!entry) {
      sileo.info({ title: 'Ya no se puede deshacer', description: 'Podés volver a agregar el producto desde su página.' })
      return
    }
    consumedRef.current.add(key)
    bufferRef.current = bufferRef.current.filter(e => e.key !== key)

    // Invitado: la tabla inventory no es legible; se usan las RPC públicas de disponibilidad
    const stock = user
      ? await cartService.getLineStock(entry.productId, entry.variantId)
      : await cartService.getPublicLineStock(entry.productId, entry.variantId)
    if (!stock || !stock.active) {
      sileo.warning({ title: 'No se pudo deshacer', description: `${entry.nombre} ya no está disponible.` })
      return
    }
    // Si el usuario ya lo volvió a agregar, se suma a esa línea sin superar el stock
    const enCarrito = itemsRef.current
      .filter(i => i.product_id === entry.productId && (i.variant_id ?? null) === entry.variantId)
      .reduce((sum, i) => sum + i.cantidad, 0)
    const cantidad = Math.min(entry.cantidad, stock.available - enCarrito)
    if (cantidad <= 0) {
      sileo.warning({ title: 'No se pudo deshacer', description: `Ya no hay stock disponible de ${entry.nombre}.` })
      return
    }

    try {
      // Camino normal del carrito (mismo precio unitario que tenía la línea; el checkout valida cambios)
      await addToCart(entry.productId, entry.precioUnitario, cantidad, entry.variantId)
    } catch {
      sileo.error({ title: 'No se pudo deshacer', description: 'Intentá agregarlo de nuevo desde su página.' })
      return
    }

    const title = cantidad < entry.cantidad
      ? `Restauramos ${cantidad} de ${entry.cantidad} unidades`
      : 'Producto restaurado'
    const restored = cantidad < entry.cantidad
      ? `No hay stock para más unidades de ${entry.nombre}.`
      : entry.nombre
    pruneBuffer()
    const previous = bufferRef.current[bufferRef.current.length - 1]
    if (previous) {
      // Queda otra eliminación reciente: el aviso ofrece deshacer también esa
      showUndoToast(title, previous, `${restored}. ¿Deshacer también "${previous.nombre}"?`)
    } else if (cantidad < entry.cantidad) {
      sileo.warning({ title, description: restored })
    } else {
      sileo.success({ title, description: restored })
    }
  }, [addToCart, showUndoToast, user])

  useEffect(() => {
    undoRef.current = undo
  }, [undo])

  const remove = useCallback(async (item: CartItemWithProduct) => {
    const entry: RemovedLine = {
      key: ++keyRef.current,
      productId: item.product_id,
      variantId: item.variant_id ?? null,
      cantidad: item.cantidad,
      precioUnitario: item.precio_unitario,
      nombre: lineName(item),
      removedAt: Date.now(),
    }
    const ok = await removeItem(item.id)
    if (!ok) return
    pruneBuffer()
    bufferRef.current = [...bufferRef.current, entry].slice(-MAX_UNDO_BUFFER)
    showUndoToast('Producto quitado del carrito', entry, entry.nombre)
    focusCartHeading()
  }, [removeItem, showUndoToast])

  const requestRemove = useCallback<CartRemovalContextType['requestRemove']>((item, opener) => {
    if (readSkipConfirm()) {
      void remove(item)
      return
    }
    openerRef.current = opener ?? null
    confirmedRef.current = false
    setDontAskAgain(false)
    setPending(item)
  }, [remove])

  // Cancelar enfocado al abrir, para evitar borrados accidentales
  useEffect(() => {
    if (!pending) return
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-cart-remove-cancel]')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [pending])

  // Cancelar, Esc o click fuera (también corre al cerrarse el diálogo tras confirmar)
  const handleClose = useCallback(() => {
    setPending(null)
    const opener = openerRef.current
    openerRef.current = null
    // Después de que el diálogo se cierre: mientras está abierto, el resto de la página es inerte
    if (!confirmedRef.current && opener) requestAnimationFrame(() => opener.focus())
  }, [])

  const handleConfirm = () => {
    if (!pending) return
    // La preferencia solo se guarda al confirmar con la casilla marcada
    if (dontAskAgain) saveSkipConfirm()
    confirmedRef.current = true
    const item = pending
    setPending(null)
    void remove(item)
  }

  const trapFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const dialog = e.currentTarget.querySelector('dialog[open]')
    if (!dialog) return
    const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const value = useMemo(() => ({ requestRemove }), [requestRemove])
  const image = pending ? cartItemImage(pending) : null
  const label = pending ? cartItemOptionLabel(pending) : null

  return (
    <CartRemovalContext.Provider value={value}>
      {children}
      {/* Foco atrapado: Tab y Shift+Tab ciclan dentro del diálogo (el nativo sale a la barra del navegador) */}
      <div className="contents" onKeyDown={trapFocus}>
        <Modal
          open={pending !== null}
          onClose={handleClose}
          title="¿Quitar este producto del carrito?"
          description="Vas a poder deshacerlo desde el aviso que aparece después."
          size="sm"
          hideCloseButton
          footer={
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button data-cart-remove-cancel type="button" variant="outline" className="min-h-tap" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" className="min-h-tap" onClick={handleConfirm}>
                Quitar
              </Button>
            </div>
          }
        >
          {pending && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                  {image?.url ? (
                    <img src={image.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-gray-300" aria-hidden="true">📦</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary-dark break-words">{pending.products?.titulo ?? 'Producto'}</p>
                  {label && <p className="text-xs text-gray-500 mt-0.5">{label}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">Cantidad: {pending.cantidad}</p>
                </div>
              </div>
              <label className="flex items-center gap-3 min-h-tap cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={e => setDontAskAgain(e.target.checked)}
                  className="w-5 h-5 shrink-0 accent-accent cursor-pointer"
                />
                No mostrar este mensaje otra vez
              </label>
            </div>
          )}
        </Modal>
      </div>
    </CartRemovalContext.Provider>
  )
}
