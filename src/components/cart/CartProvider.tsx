import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from 'react'
import { CartContext, type CartContextType, type MergeStrategy } from './CartContext'
import CartMergeModal from './CartMergeModal'
import { cartService } from '../../services/cart.service'
import { supabase } from '../../lib/supabase/client'
import useAuth from '../../hooks/useAuth'
import type { CartItemWithProduct, LocalCartItem } from '../../types/cart'
import {
  buildGuestCart,
  clearLocalCart,
  guestLineKeyFromId,
  lineKey,
  readLocalCart,
  writeLocalCart,
  type GuestCartDetails,
} from '../../lib/guestCart'

interface CartProviderProps {
  children: ReactNode
}

const EMPTY_SET = new Set<number>()

function calcLocalItemCount(items: LocalCartItem[]): number {
  return items.reduce((sum, item) => sum + item.cantidad, 0)
}

function calcLocalSubtotal(items: LocalCartItem[]): number {
  return items.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0)
}

function calcItemCount(items: CartItemWithProduct[]): number {
  return items.reduce((sum, item) => sum + item.cantidad, 0)
}

function calcSubtotal(items: CartItemWithProduct[]): number {
  return items.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0)
}

export default function CartProvider({ children }: CartProviderProps) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItemWithProduct[]>([])
  const [localItems, setLocalItems] = useState<LocalCartItem[]>(() => readLocalCart())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncPending, setSyncPending] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [localItemsForSync, setLocalItemsForSync] = useState<LocalCartItem[]>([])
  const [serverItemCount, setServerItemCount] = useState(0)
  const [unavailableItems, setUnavailableItems] = useState<Set<number>>(new Set())
  const [availabilityChecked, setAvailabilityChecked] = useState(false)
  const cartIdRef = useRef<string | null>(null)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)
  const syncCompletedRef = useRef(false)

  // Invitado: detalles (títulos, precios vigentes, fotos, stock) de sus líneas locales. Se piden recién
  // cuando una pantalla los necesita (checkAvailability), no en cada página de la tienda
  const [guestDetails, setGuestDetails] = useState<GuestCartDetails | null>(null)
  const [guestRequest, setGuestRequest] = useState(0)
  const fetchedRequestRef = useRef(0)
  const guestKeys = localItems.map(item => lineKey(item.product_id, item.variant_id)).sort().join('|')

  useEffect(() => {
    if (user || guestRequest === 0) return
    // Pedido ya atendido y sin líneas nuevas: alcanza con los detalles que hay (cambiar cantidades o
    // quitar líneas no vuelve a consultar)
    const covered = guestDetails && guestKeys.split('|').every(key => !key || guestDetails.keys.has(key))
    if (covered && fetchedRequestRef.current === guestRequest) return
    fetchedRequestRef.current = guestRequest
    let cancelled = false
    const lines = guestKeys ? guestKeys.split('|').map(key => {
      const [productId, variant] = key.split(':')
      return { product_id: Number(productId), variant_id: variant === 'base' ? null : Number(variant) }
    }) : []
    cartService.getGuestCartDetails(lines).then(details => {
      if (cancelled) return
      if (details) {
        setGuestDetails(details)
      } else {
        setError('No pudimos cargar tu carrito. Intentá de nuevo en unos minutos.')
      }
    })
    return () => { cancelled = true }
    // guestDetails no va en las dependencias: solo se consulta cuando cambian las líneas o se pide de nuevo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, guestRequest, guestKeys])

  const guestCart = useMemo(
    () => (!user && guestDetails ? buildGuestCart(localItems, guestDetails) : null),
    [user, guestDetails, localItems]
  )
  const guestAvailableRef = useRef(new Map<number, number>())
  useEffect(() => {
    guestAvailableRef.current = new Map((guestCart?.items ?? []).map(item => [item.id, item.available ?? 0]))
  }, [guestCart])

  const fetchServerCartItems = useCallback(async (cartId: string) => {
    const { data: cartItems, error: itemsError } = await cartService.getCartItems(cartId)
    if (itemsError) throw new Error(itemsError.message)
    return cartItems || []
  }, [])

  const loadServerCart = useCallback(async (userId: string) => {
    try {
      setLoading(true)
      setError(null)
      const { data: cart, error: cartError } = await cartService.getOrCreateActiveCart(userId)
      if (cartError) throw new Error(cartError.message)
      if (!cart) throw new Error('No se pudo obtener el carrito')

      cartIdRef.current = cart.id
      const cartItems = await fetchServerCartItems(cart.id)
      setItems(cartItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el carrito')
    } finally {
      setLoading(false)
    }
  }, [fetchServerCartItems])

  const checkAvailability = useCallback(async () => {
    // Invitado: pide (o vuelve a pedir) los detalles y el stock de sus líneas locales
    if (!user) {
      setGuestRequest(n => n + 1)
      return
    }
    if (items.length === 0) {
      setUnavailableItems(new Set())
      setAvailabilityChecked(true)
      return
    }

    const productIds = [...new Set(items.map(i => i.product_id))]
    const variantIds = [...new Set(items.filter(i => i.variant_id != null).map(i => i.variant_id as number))]

    const inventoryMap = new Map<string, number>()

    if (productIds.length > 0) {
      const { data } = await supabase
        .from('inventory')
        .select('product_id, quantity, reserved')
        .in('product_id', productIds)
        .is('variant_id', null)

      if (data) {
        for (const row of data) {
          inventoryMap.set(`p_${row.product_id}`, row.quantity - row.reserved)
        }
      }
    }

    if (variantIds.length > 0) {
      const { data } = await supabase
        .from('inventory')
        .select('variant_id, quantity, reserved')
        .in('variant_id', variantIds)

      if (data) {
        for (const row of data) {
          inventoryMap.set(`v_${row.variant_id}`, row.quantity - row.reserved)
        }
      }
    }

    // Un item sin variante de un producto con variantes activas solo es válido con la opción base
    // configurada (el servidor lo rechaza con INVALID_VARIANT): se marca como no disponible
    const productsWithVariants = new Set<number>()
    const noVariantProductIds = [...new Set(items.filter(i => i.variant_id == null).map(i => i.product_id))]
    if (noVariantProductIds.length > 0) {
      const { data } = await supabase
        .from('product_variants')
        .select('product_id')
        .in('product_id', noVariantProductIds)
        .eq('activo', true)

      for (const row of data ?? []) productsWithVariants.add(row.product_id)
    }

    const unavailable = new Set<number>()
    for (const item of items) {
      if (item.variant_id == null && productsWithVariants.has(item.product_id) && !item.products?.opcion_base_nombre) {
        unavailable.add(item.id)
        continue
      }

      let available: number | null = null

      if (item.variant_id != null) {
        const variantKey = `v_${item.variant_id}`
        if (inventoryMap.has(variantKey)) {
          available = inventoryMap.get(variantKey)!
        }
      }

      if (available === null) {
        const productKey = `p_${item.product_id}`
        if (inventoryMap.has(productKey)) {
          available = inventoryMap.get(productKey)!
        }
      }

      if (available !== null && available <= 0) {
        unavailable.add(item.id)
      }
    }

    setUnavailableItems(unavailable)
    setAvailabilityChecked(true)
  }, [items, user])

  const handleResolveConflict = useCallback(async (strategy: MergeStrategy) => {
    if (!user || !cartIdRef.current) return

    try {
      setLoading(true)
      setError(null)

      if (strategy === 'local') {
        const { error: replaceError } = await cartService.replaceCartItems(
          cartIdRef.current,
          localItemsForSync
        )
        if (replaceError) throw new Error(replaceError.message)
      } else if (strategy === 'merge') {
        const { error: mergeError } = await cartService.mergeLocalCart(
          cartIdRef.current,
          localItemsForSync
        )
        if (mergeError) throw new Error(mergeError.message)
      }

      const cartItems = await fetchServerCartItems(cartIdRef.current)
      setItems(cartItems)
      clearLocalCart()
      setLocalItems([])
      syncCompletedRef.current = true
      setSyncPending(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar el carrito')
    } finally {
      setLoading(false)
      setShowMergeModal(false)
      setLocalItemsForSync([])
    }
  }, [user, localItemsForSync, fetchServerCartItems])

  useEffect(() => {
    const currentUserId = user?.id ?? null
    const prevUserId = prevUserIdRef.current

    if (currentUserId === prevUserId) return
    prevUserIdRef.current = currentUserId

    if (!currentUserId) {
      cartIdRef.current = null
      setItems([])
      syncCompletedRef.current = false
      setSyncPending(false)
      setLocalItems(readLocalCart())
      setGuestDetails(null)
      return
    }

    if (syncCompletedRef.current) return

    const snapshotLocal = [...localItems]
    const hasLocal = snapshotLocal.length > 0

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: cart, error: cartError } = await cartService.getOrCreateActiveCart(currentUserId)
        if (cartError) throw new Error(cartError.message)
        if (!cart) throw new Error('No se pudo obtener el carrito')

        cartIdRef.current = cart.id
        const serverItems = await fetchServerCartItems(cart.id)
        const hasServer = serverItems.length > 0

        if (!hasLocal && !hasServer) {
          setItems([])
          syncCompletedRef.current = true
          setSyncPending(false)
        } else if (hasLocal && !hasServer) {
          const { error: replaceError } = await cartService.replaceCartItems(cart.id, snapshotLocal)
          if (replaceError) throw new Error(replaceError.message)

          const cartItems = await fetchServerCartItems(cart.id)
          setItems(cartItems)
          clearLocalCart()
          setLocalItems([])
          syncCompletedRef.current = true
          setSyncPending(false)
        } else if (!hasLocal && hasServer) {
          setItems(serverItems)
          clearLocalCart()
          setLocalItems([])
          syncCompletedRef.current = true
          setSyncPending(false)
        } else {
          setLocalItemsForSync(snapshotLocal)
          setServerItemCount(serverItems.length)
          setItems(serverItems)
          setShowMergeModal(true)
          setSyncPending(true)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al sincronizar el carrito')
      } finally {
        setLoading(false)
      }
    })()
  }, [user, localItems, fetchServerCartItems])

  useEffect(() => {
    if (!user) {
      writeLocalCart(localItems)
    }
  }, [localItems, user])

  useEffect(() => {
    if (!loading && items.length > 0 && user) {
      checkAvailability()
    }
  }, [loading, items, user, checkAvailability])

  const addToCart = useCallback(async (
    productId: number,
    precioUnitario: number,
    cantidad: number = 1,
    variantId: number | null = null
  ) => {
    if (user) {
      try {
        setLoading(true)
        setError(null)
        if (!cartIdRef.current) {
          const { data: cart } = await cartService.getOrCreateActiveCart(user.id)
          if (cart) cartIdRef.current = cart.id
        }
        if (!cartIdRef.current) throw new Error('No se pudo crear el carrito')

        const { error: addError } = await cartService.addItem(cartIdRef.current, {
          product_id: productId,
          variant_id: variantId,
          cantidad,
          precio_unitario: precioUnitario,
        })
        if (addError) throw new Error(addError.message)

        const { data: updatedItems } = await cartService.getCartItems(cartIdRef.current)
        setItems(updatedItems || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al agregar al carrito')
        throw err
      } finally {
        setLoading(false)
      }
    } else {
      setLocalItems(prev => {
        const existingIndex = prev.findIndex(
          item => item.product_id === productId && item.variant_id === (variantId ?? null)
        )
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = {
            ...updated[existingIndex],
            cantidad: updated[existingIndex].cantidad + cantidad,
          }
          return updated
        }
        return [...prev, { product_id: productId, variant_id: variantId ?? null, cantidad, precio_unitario: precioUnitario }]
      })
    }
  }, [user])

  const updateQuantity = useCallback(async (itemId: number, cantidad: number) => {
    if (user) {
      try {
        setLoading(true)
        setError(null)
        if (!cartIdRef.current) return

        const { error: updateError } = await cartService.updateItemQuantity(itemId, cantidad)
        if (updateError) throw new Error(updateError.message)

        if (cantidad <= 0) {
          setItems(prev => prev.filter(item => item.id !== itemId))
        } else {
          setItems(prev =>
            prev.map(item =>
              item.id === itemId ? { ...item, cantidad } : item
            )
          )
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar cantidad')
      } finally {
        setLoading(false)
      }
    } else {
      // Invitado: la línea exacta (producto + variante o base), con tope en el stock conocido
      const key = guestLineKeyFromId(itemId)
      if (!key) return
      const available = guestAvailableRef.current.get(itemId)
      setLocalItems(prev =>
        prev.flatMap(item => {
          if (lineKey(item.product_id, item.variant_id) !== key) return [item]
          if (cantidad <= 0) return []
          const next = available !== undefined && cantidad > item.cantidad ? Math.min(cantidad, available) : cantidad
          return [{ ...item, cantidad: Math.max(1, next) }]
        })
      )
    }
  }, [user])

  const removeItem = useCallback(async (itemId: number) => {
    if (user) {
      try {
        setLoading(true)
        setError(null)

        const { error: removeError } = await cartService.removeItem(itemId)
        if (removeError) throw new Error(removeError.message)

        setItems(prev => prev.filter(item => item.id !== itemId))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar producto')
        return false
      } finally {
        setLoading(false)
      }
    } else {
      // Invitado: solo la línea exacta (antes se quitaban todas las líneas del mismo producto)
      const key = guestLineKeyFromId(itemId)
      if (!key) return false
      setLocalItems(prev => prev.filter(item => lineKey(item.product_id, item.variant_id) !== key))
      return true
    }
  }, [user])

  // Invitado, antes de ir a login: guarda los precios vigentes (misma forma de línea), para que la fusión
  // con la cuenta no arrastre precios viejos al checkout
  const syncGuestPrices = useCallback(() => {
    if (user || !guestCart) return
    const prices = new Map(guestCart.items.map(item => [lineKey(item.product_id, item.variant_id), item.precio_unitario]))
    setLocalItems(prev => prev.map(item => {
      const precio = prices.get(lineKey(item.product_id, item.variant_id))
      return precio !== undefined && precio !== item.precio_unitario ? { ...item, precio_unitario: precio } : item
    }))
  }, [user, guestCart])

  const clearCart = useCallback(async () => {
    if (user) {
      try {
        setLoading(true)
        setError(null)
        if (!cartIdRef.current) return

        const { error: clearError } = await cartService.clearCart(cartIdRef.current)
        if (clearError) throw new Error(clearError.message)

        setItems([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al vaciar el carrito')
      } finally {
        setLoading(false)
      }
    } else {
      setLocalItems([])
    }
  }, [user])

  const isAuth = !!user
  const itemCount = isAuth ? calcItemCount(items) : calcLocalItemCount(localItems)
  // Invitado: líneas armadas desde localStorage (con precios vigentes) cuando ya se pidieron los detalles
  const subtotal = isAuth
    ? calcSubtotal(items)
    : guestCart ? calcSubtotal(guestCart.items) : calcLocalSubtotal(localItems)

  const value: CartContextType = {
    items: isAuth ? items : guestCart?.items ?? [],
    localItems,
    itemCount,
    subtotal,
    loading,
    error,
    syncPending,
    unavailableItems: isAuth ? unavailableItems : guestCart?.unavailable ?? EMPTY_SET,
    availabilityChecked: isAuth ? availabilityChecked : guestCart !== null,
    syncGuestPrices,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    resolveCartConflict: handleResolveConflict,
    checkAvailability,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartMergeModal
        open={showMergeModal}
        onSelect={handleResolveConflict}
        loading={loading}
        localCount={localItemsForSync.length}
        serverCount={serverItemCount}
      />
    </CartContext.Provider>
  )
}
