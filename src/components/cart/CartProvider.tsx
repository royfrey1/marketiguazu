import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { CartContext, type CartContextType, type MergeStrategy } from './CartContext'
import CartMergeModal from './CartMergeModal'
import { cartService } from '../../services/cart.service'
import { supabase } from '../../lib/supabase/client'
import useAuth from '../../hooks/useAuth'
import type { CartItemWithProduct, LocalCartItem } from '../../types/cart'

const LOCAL_STORAGE_KEY = 'iguazu_cart'

interface CartProviderProps {
  children: ReactNode
}

function readLocalCart(): LocalCartItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item: unknown): item is LocalCartItem =>
        typeof item === 'object' &&
        item !== null &&
        'product_id' in item &&
        'cantidad' in item &&
        'precio_unitario' in item
    )
  } catch {
    return []
  }
}

function writeLocalCart(items: LocalCartItem[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
}

function clearLocalCart() {
  localStorage.removeItem(LOCAL_STORAGE_KEY)
}

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

    const unavailable = new Set<number>()
    for (const item of items) {
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
  }, [items])

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
      setLocalItems(prev =>
        prev.map(item => {
          if (item.product_id === itemId) {
            if (cantidad <= 0) return null
            return { ...item, cantidad }
          }
          return item
        }).filter((item): item is LocalCartItem => item !== null)
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar producto')
      } finally {
        setLoading(false)
      }
    } else {
      setLocalItems(prev => prev.filter(item => item.product_id !== itemId))
    }
  }, [user])

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
  const subtotal = isAuth ? calcSubtotal(items) : calcLocalSubtotal(localItems)

  const value: CartContextType = {
    items,
    localItems,
    itemCount,
    subtotal,
    loading,
    error,
    syncPending,
    unavailableItems,
    availabilityChecked,
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
