import { useEffect, useRef } from 'react'
import useAuth from './useAuth'
import useCart from './useCart'

/**
 * Vacía el carrito una vez que el pedido quedó registrado (vuelta de Mercado Pago
 * con ?order=N en éxito o pendiente).
 *
 * Al volver de MP la página se carga de cero: la sesión se rehidrata y el carrito
 * del servidor se carga de forma asíncrona. Si se llamara a clearCart() al montar,
 * todavía no habría usuario ni id de carrito y no vaciaría nada, así que se espera
 * a que el carrito del usuario esté cargado y tenga ítems.
 */
export default function useClearCartOnOrder(orderId: number | null) {
  const { user, loading: authLoading } = useAuth()
  const { itemCount, loading: cartLoading, syncPending, clearCart } = useCart()
  const clearedOrderRef = useRef<number | null>(null)

  useEffect(() => {
    if (!orderId || authLoading || !user || cartLoading || syncPending) return
    if (itemCount === 0 || clearedOrderRef.current === orderId) return
    clearedOrderRef.current = orderId
    void clearCart()
  }, [orderId, authLoading, user, cartLoading, syncPending, itemCount, clearCart])
}
