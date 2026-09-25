import { useState, useCallback, useRef } from 'react'
import {
  orderService,
  type OrderStatus,
  type PaymentStatus,
  type ShipmentStatus,
  type CreateShipmentInput,
  type UpdateShipmentInput,
  type OrderStatusResult,
  type PaymentStatusResult,
  type CancelOrderResult,
  type ShipmentCreatedResult,
  type ShipmentUpdateResult,
  type ShipmentStatusResult,
} from '../services/order.service'

interface MutationState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

const INITIAL: MutationState<never> = { data: null, loading: false, error: null }

const BUSY_ERROR = 'La operación ya está en curso.'

export function useAdminOrderMutations() {
  const [updateOrderStatus, setUpdateOrderStatus] = useState<MutationState<OrderStatusResult>>(INITIAL)
  const [updatePaymentStatus, setUpdatePaymentStatus] = useState<MutationState<PaymentStatusResult>>(INITIAL)
  const [cancelOrder, setCancelOrder] = useState<MutationState<CancelOrderResult>>(INITIAL)
  const [createShipment, setCreateShipment] = useState<MutationState<ShipmentCreatedResult>>(INITIAL)
  const [updateShipment, setUpdateShipment] = useState<MutationState<ShipmentUpdateResult>>(INITIAL)
  const [updateShipmentStatus, setUpdateShipmentStatus] = useState<MutationState<ShipmentStatusResult>>(INITIAL)

  const busyUpdateOrderStatus = useRef(false)
  const busyUpdatePaymentStatus = useRef(false)
  const busyCancelOrder = useRef(false)
  const busyCreateShipment = useRef(false)
  const busyUpdateShipment = useRef(false)
  const busyUpdateShipmentStatus = useRef(false)

  const execUpdateOrderStatus = useCallback(async (orderId: number, newStatus: OrderStatus) => {
    if (busyUpdateOrderStatus.current) {
      return { success: false as const, error: BUSY_ERROR }
    }
    busyUpdateOrderStatus.current = true
    setUpdateOrderStatus({ data: null, loading: true, error: null })
    try {
      const result = await orderService.updateOrderStatus(orderId, newStatus)
      if (result.error) {
        setUpdateOrderStatus({ data: null, loading: false, error: result.error.message })
        return { success: false as const, error: result.error.message }
      }
      setUpdateOrderStatus({ data: result.data, loading: false, error: null })
      return { success: true as const, data: result.data! }
    } finally {
      busyUpdateOrderStatus.current = false
    }
  }, [])

  const execUpdatePaymentStatus = useCallback(async (paymentId: number, newStatus: PaymentStatus) => {
    if (busyUpdatePaymentStatus.current) {
      return { success: false as const, error: BUSY_ERROR }
    }
    busyUpdatePaymentStatus.current = true
    setUpdatePaymentStatus({ data: null, loading: true, error: null })
    try {
      const result = await orderService.updatePaymentStatus(paymentId, newStatus)
      if (result.error) {
        setUpdatePaymentStatus({ data: null, loading: false, error: result.error.message })
        return { success: false as const, error: result.error.message }
      }
      setUpdatePaymentStatus({ data: result.data, loading: false, error: null })
      return { success: true as const, data: result.data! }
    } finally {
      busyUpdatePaymentStatus.current = false
    }
  }, [])

  const execCancelOrder = useCallback(async (orderId: number, reason?: string) => {
    if (busyCancelOrder.current) {
      return { success: false as const, error: BUSY_ERROR }
    }
    busyCancelOrder.current = true
    setCancelOrder({ data: null, loading: true, error: null })
    try {
      const result = await orderService.cancelOrder(orderId, reason)
      if (result.error) {
        setCancelOrder({ data: null, loading: false, error: result.error.message })
        return { success: false as const, error: result.error.message }
      }
      setCancelOrder({ data: result.data, loading: false, error: null })
      return { success: true as const, data: result.data! }
    } finally {
      busyCancelOrder.current = false
    }
  }, [])

  const execCreateShipment = useCallback(async (input: CreateShipmentInput) => {
    if (busyCreateShipment.current) {
      return { success: false as const, error: BUSY_ERROR }
    }
    busyCreateShipment.current = true
    setCreateShipment({ data: null, loading: true, error: null })
    try {
      const result = await orderService.createShipment(input)
      if (result.error) {
        setCreateShipment({ data: null, loading: false, error: result.error.message })
        return { success: false as const, error: result.error.message }
      }
      setCreateShipment({ data: result.data, loading: false, error: null })
      return { success: true as const, data: result.data! }
    } finally {
      busyCreateShipment.current = false
    }
  }, [])

  const execUpdateShipment = useCallback(async (shipmentId: number, input: UpdateShipmentInput) => {
    if (busyUpdateShipment.current) {
      return { success: false as const, error: BUSY_ERROR }
    }
    busyUpdateShipment.current = true
    setUpdateShipment({ data: null, loading: true, error: null })
    try {
      const result = await orderService.updateShipment(shipmentId, input)
      if (result.error) {
        setUpdateShipment({ data: null, loading: false, error: result.error.message })
        return { success: false as const, error: result.error.message }
      }
      setUpdateShipment({ data: result.data, loading: false, error: null })
      return { success: true as const, data: result.data! }
    } finally {
      busyUpdateShipment.current = false
    }
  }, [])

  const execUpdateShipmentStatus = useCallback(async (shipmentId: number, newStatus: ShipmentStatus) => {
    if (busyUpdateShipmentStatus.current) {
      return { success: false as const, error: BUSY_ERROR }
    }
    busyUpdateShipmentStatus.current = true
    setUpdateShipmentStatus({ data: null, loading: true, error: null })
    try {
      const result = await orderService.updateShipmentStatus(shipmentId, newStatus)
      if (result.error) {
        setUpdateShipmentStatus({ data: null, loading: false, error: result.error.message })
        return { success: false as const, error: result.error.message }
      }
      setUpdateShipmentStatus({ data: result.data, loading: false, error: null })
      return { success: true as const, data: result.data! }
    } finally {
      busyUpdateShipmentStatus.current = false
    }
  }, [])

  return {
    updateOrderStatus: { ...updateOrderStatus, execute: execUpdateOrderStatus },
    updatePaymentStatus: { ...updatePaymentStatus, execute: execUpdatePaymentStatus },
    cancelOrder: { ...cancelOrder, execute: execCancelOrder },
    createShipment: { ...createShipment, execute: execCreateShipment },
    updateShipment: { ...updateShipment, execute: execUpdateShipment },
    updateShipmentStatus: { ...updateShipmentStatus, execute: execUpdateShipmentStatus },
  }
}
