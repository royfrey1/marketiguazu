import { useState, useEffect, useCallback, useRef } from 'react'
import {
  productSpecificationsService,
  type ProductSpecificationRow,
  type CreateProductSpecificationInput,
  type UpdateProductSpecificationInput,
  type ReorderInput,
} from '../services/productSpecifications.service'

interface UseProductSpecificationsState {
  data: ProductSpecificationRow[]
  loading: boolean
  error: string | null
}

export function useProductSpecifications(productId: number | null) {
  const [state, setState] = useState<UseProductSpecificationsState>({
    data: [],
    loading: false,
    error: null,
  })

  const [refreshKey, setRefreshKey] = useState(0)
  const prevProductIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!productId) {
      if (prevProductIdRef.current !== null) {
        setState({ data: [], loading: false, error: null })
      }
      prevProductIdRef.current = null
      return
    }

    prevProductIdRef.current = productId
    let cancelled = false

    const run = async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      const { data, error } = await productSpecificationsService.getByProductId(productId)
      if (!cancelled) {
        setState({
          data: data || [],
          loading: false,
          error: error?.message ?? null,
        })
      }
    }

    run()
    return () => { cancelled = true }
  }, [productId, refreshKey])

  const refetch = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const create = useCallback(
    async (input: Omit<CreateProductSpecificationInput, 'product_id'>) => {
      if (!productId) return { error: new Error('No product ID') }
      const result = await productSpecificationsService.create({
        ...input,
        product_id: productId,
      })
      if (!result.error) refetch()
      return result
    },
    [productId, refetch]
  )

  const createMany = useCallback(
    async (inputs: Omit<CreateProductSpecificationInput, 'product_id'>[]) => {
      if (!productId) return { data: [], error: new Error('No product ID') }
      const result = await productSpecificationsService.createMany(
        inputs.map(input => ({ ...input, product_id: productId }))
      )
      if (!result.error) refetch()
      return result
    },
    [productId, refetch]
  )

  const update = useCallback(
    async (id: number, updates: UpdateProductSpecificationInput) => {
      const result = await productSpecificationsService.update(id, updates)
      if (!result.error) refetch()
      return result
    },
    [refetch]
  )

  const remove = useCallback(
    async (id: number) => {
      const result = await productSpecificationsService.delete(id)
      if (!result.error) refetch()
      return result
    },
    [refetch]
  )

  const reorder = useCallback(
    async (items: ReorderInput[]) => {
      const result = await productSpecificationsService.reorder(items)
      if (!result.error) refetch()
      return result
    },
    [refetch]
  )

  return {
    ...state,
    refetch,
    create,
    createMany,
    update,
    remove,
    reorder,
  }
}
