import { z } from 'zod'
import { requiredText, optionalText, positiveNumber, nonNegativeNumber } from './common'

/**
 * Schema base para productos del e-commerce.
 *
 * Cubre conceptualmente los campos que tendrá un producto.
 * NO incluye variantes, stock, pagos, pedidos ni envíos:
 * esos schemas se crearán cuando esas entidades se implementen.
 */

const shippingDimensionField = (label: string, max: number) =>
  z.coerce
    .number({ message: `${label} debe ser un número` })
    .int(`${label} debe ser un número entero`)
    .positive(`${label} debe ser mayor a 0`)
    .max(max, `${label} no puede superar ${max}`)
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' || val === undefined ? null : val))

export const productSchema = z.object({
  titulo: requiredText('El título', 3, 150),
  descripcion: optionalText(2000),
  precio: positiveNumber('El precio'),
  precio_anterior: nonNegativeNumber('El precio anterior')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' || val === undefined ? null : val)),
  categoria_id: z.coerce
    .number({ message: 'Seleccioná una categoría' })
    .int('La categoría debe ser un número entero')
    .positive('Seleccioná una categoría'),
  marca: optionalText(100),
  sku: optionalText(50),
  activo: z.boolean().default(true),
  destacado: z.boolean().default(false),
  peso_envio_gramos: shippingDimensionField('El peso', 25000),
  alto_paquete_cm: shippingDimensionField('El alto', 150),
  ancho_paquete_cm: shippingDimensionField('El ancho', 150),
  largo_paquete_cm: shippingDimensionField('El largo', 150),
})

export type ProductFormData = z.infer<typeof productSchema>

/**
 * Schema para crear un producto (campos obligatorios ajustados).
 * Extiende el schema base forzando campos requeridos para alta.
 */
export const createProductSchema = productSchema.extend({
  titulo: requiredText('El título', 3, 150),
  precio: positiveNumber('El precio'),
  categoria_id: z.coerce
    .number({ message: 'Seleccioná una categoría' })
    .int()
    .positive('Seleccioná una categoría'),
})

export type CreateProductFormData = z.infer<typeof createProductSchema>

/**
 * Schema para editar un producto.
 * Todos los campos son opcionales excepto el id.
 */
export const editProductSchema = productSchema.partial().extend({
  id: z.coerce.number().int().positive(),
})

export type EditProductFormData = z.infer<typeof editProductSchema>
