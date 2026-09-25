import { z } from 'zod'
import { requiredText, phone } from './common'

export const addressSchema = z.object({
  nombre: requiredText('El nombre', 1, 100),
  calle: requiredText('La calle', 1, 255),
  numero: z.string().max(20).trim().optional().or(z.literal('')),
  piso: z.string().max(10).trim().optional().or(z.literal('')),
  departamento: z.string().max(50).trim().optional().or(z.literal('')),
  ciudad: requiredText('La ciudad', 1, 100),
  provincia: requiredText('La provincia', 1, 100),
  codigo_postal: requiredText('El código postal', 1, 20),
  pais: requiredText('El país', 1, 100),
  telefono: phone.optional().or(z.literal('')),
  es_default: z.boolean(),
})

export type AddressFormData = z.infer<typeof addressSchema>
