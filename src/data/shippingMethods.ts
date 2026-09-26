export interface ShippingMethod {
  id: string
  name: string
  description: string
  estimatedDays: string
}

export const shippingMethods: ShippingMethod[] = [
  {
    id: 'correo_argentino',
    name: 'Correo Argentino',
    description: 'Envío gratis a todo el país por Correo Argentino.',
    estimatedDays: '5–8 días hábiles',
  },
]

export function getShippingMethodById(id: string): ShippingMethod | undefined {
  return shippingMethods.find(m => m.id === id)
}
