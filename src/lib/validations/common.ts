import { z } from 'zod'

/**
 * Validaciones comunes reutilizables.
 *
 * Estos schemas se pueden componer en otros schemas del proyecto.
 * Cada export incluye el schema Zod y, cuando aplica, el tipo inferido.
 */

// --- Texto ---

export const requiredText = (label: string, min = 1, max = 255) =>
  z
    .string()
    .min(min, `${label} es obligatorio`)
    .max(max, `${label} no puede superar ${max} caracteres`)
    .trim()

export const optionalText = (max = 255) =>
  z.string().max(max).trim().optional().or(z.literal(''))

// --- Email ---

export const email = z
  .string()
  .email('Ingresá un correo electrónico válido')
  .max(255, 'El correo no puede superar 255 caracteres')
  .trim()
  .toLowerCase()

// --- Contraseña ---

export const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres')

export const confirmPassword = (passwordField: string) =>
  z.string().min(1, 'Confirmá tu contraseña').superRefine((val, ctx) => {
    const parent = ctx.path.length > 0 ? ctx.parent : undefined
    if (parent && parent[passwordField] !== val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las contraseñas no coinciden',
      })
    }
  })

// --- Teléfono ---

export const phone = z
  .string()
  .min(8, 'El teléfono debe tener al menos 8 caracteres')
  .max(20, 'El teléfono no puede superar 20 caracteres')
  .regex(/^\+?[\d\s\-()]+$/, 'El teléfono solo puede contener números, espacios, guiones y paréntesis')
  .trim()

// --- Números ---

export const positiveNumber = (label: string) =>
  z.coerce
    .number({ message: `${label} debe ser un número` })
    .positive(`${label} debe ser mayor a 0`)

export const nonNegativeNumber = (label: string) =>
  z.coerce
    .number({ message: `${label} debe ser un número` })
    .min(0, `${label} no puede ser negativo`)

// --- IDs ---

export const idNumber = z.coerce.number().int().positive()

// --- Búsqueda ---

export const searchQuery = z
  .string()
  .max(200, 'La búsqueda no puede superar 200 caracteres')
  .trim()
  .optional()
  .or(z.literal(''))
