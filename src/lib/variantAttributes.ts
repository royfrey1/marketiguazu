/**
 * Nombre de atributo tal como se guarda como clave en `atributos` (jsonb).
 * Quita la puntuación tipeada por costumbre ("Color:" → "Color",
 * "  Capacidad ; " → "Capacidad"), porque la tienda busca las claves exactas
 * para armar los selectores.
 */
export function sanitizeAttributeName(name: string): string {
  return name.trim().replace(/[:;,.]/g, '').trim()
}
