import { z } from 'zod'
import { requiredText, optionalText, positiveNumber, nonNegativeNumber } from './common'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]*)*$/

const shippingDimensionField = (label: string, max: number) =>
  z.coerce
    .number({ message: `${label} debe ser un número` })
    .int(`${label} debe ser un número entero`)
    .positive(`${label} debe ser mayor a 0`)
    .max(max, `${label} no puede superar ${max}`)
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' || val === undefined ? null : val))

const logisticsFields = {
  peso_envio_gramos: shippingDimensionField('El peso', 25000),
  alto_paquete_cm: shippingDimensionField('El alto', 150),
  ancho_paquete_cm: shippingDimensionField('El ancho', 150),
  largo_paquete_cm: shippingDimensionField('El largo', 150),
}

function allNullOrAllPresent(val: {
  peso_envio_gramos: number | null
  alto_paquete_cm: number | null
  ancho_paquete_cm: number | null
  largo_paquete_cm: number | null
}) {
  const fields = [val.peso_envio_gramos, val.alto_paquete_cm, val.ancho_paquete_cm, val.largo_paquete_cm]
  const allNull = fields.every((f) => f === null)
  const allPresent = fields.every((f) => f !== null && f !== undefined)
  return allNull || allPresent
}

export const adminProductSchema = z
  .object({
    titulo: requiredText('El título', 3, 150),
    slug: requiredText('El slug', 2, 150)
      .regex(slugRegex, 'El slug solo puede contener letras minúsculas, números y guiones')
      .refine(
        (val) => !val.startsWith('-') && !val.endsWith('-'),
        'El slug no puede comenzar ni terminar con guión'
      ),
    descripcion: optionalText(2000),
    marca: optionalText(100),
    category_id: z.coerce
      .number({ message: 'Seleccioná una categoría' })
      .int('La categoría debe ser un número entero')
      .positive('Seleccioná una categoría'),
    precio: positiveNumber('El precio'),
    precio_anterior: nonNegativeNumber('El precio anterior')
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' || val === undefined ? null : val)),
    activo: z.boolean().default(true),
    destacado: z.boolean().default(false),
    ...logisticsFields,
  })
  .superRefine((val, ctx) => {
    if (!allNullOrAllPresent(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Completá todos los campos de logística o dejalos todos vacíos',
        path: ['peso_envio_gramos'],
      })
    }
  })

export type AdminProductFormData = z.infer<typeof adminProductSchema>
