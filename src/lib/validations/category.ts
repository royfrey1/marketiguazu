import { z } from 'zod'
import { requiredText, optionalText } from './common'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]*)*$/

export const categorySchema = z.object({
  nombre: requiredText('El nombre', 2, 100),
  slug: requiredText('El slug', 2, 100)
    .regex(slugRegex, 'El slug solo puede contener letras minúsculas, números y guiones')
    .refine(
      (val) => !val.startsWith('-') && !val.endsWith('-'),
      'El slug no puede comenzar ni terminar con guión'
    ),
  icono: optionalText(10),
  parent_id: z
    .number()
    .int()
    .positive()
    .nullable(),
  activo: z.boolean(),
  sort_order: z
    .number({ message: 'El orden debe ser un número' })
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo'),
})

export type CategoryFormData = z.infer<typeof categorySchema>

export const createCategorySchema = categorySchema

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>

export const editCategorySchema = categorySchema.partial()

export type EditCategoryFormData = z.infer<typeof editCategorySchema>
