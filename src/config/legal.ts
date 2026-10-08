// ============================================================
// Datos legales del titular de la tienda
// ============================================================
// Se usan para completar los placeholders {{CLAVE}} de los textos legales
// (src/content/legal/*.md). Los valores entre corchetes están PENDIENTES:
// completarlos a mano antes del lanzamiento. No editar los .md para esto.
// ============================================================

export const LEGAL = {
  // Nombre completo de la persona titular o razón social de la empresa
  NOMBRE_O_RAZON_SOCIAL: 'Roy Walter Martinez Frey',
  // CUIT del titular (ej: 20-12345678-9)
  CUIT: '20-40914461-7',
  // Domicilio legal / fiscal completo
  DOMICILIO: 'Barrio Primavera, calle Salto Yaboty (sin numeración), casa N.º 1350, Puerto Iguazú, Misiones, CP 3370, Argentina',
  // Condición frente al IVA (ej: "Responsable Monotributo", "Responsable Inscripto")
  CONDICION_FISCAL: '[CONDICIÓN FISCAL]',
  // Plazo estimado de entrega desde la confirmación del pago (también se usa en /envios)
  PLAZO_ENTREGA: '6 a 7 días hábiles',
  // Herramientas de analíticas usadas (ej: "Vercel Analytics, que no usa cookies")
  ANALITICAS: 'Vercel Analytics, que mide las visitas al sitio de forma agregada',
  // Fecha de publicación de los textos (ej: "15 de octubre de 2026")
  FECHA_PUBLICACION: '1 de noviembre de 2026',
  // Email de contacto que se muestra en los textos legales
  EMAIL_CONTACTO: 'royfrey@outlook.com',
  // Ruta del botón de arrepentimiento (la página todavía no existe)
  LINK_ARREPENTIMIENTO: '/arrepentimiento',
} as const

export type LegalKey = keyof typeof LEGAL

function isLegalKey(key: string): key is LegalKey {
  return Object.prototype.hasOwnProperty.call(LEGAL, key)
}

/**
 * Reemplaza cada {{CLAVE}} por LEGAL[CLAVE]. Un placeholder que no esté definido
 * en LEGAL se deja tal cual (visible), para que se note y no rompa el render.
 */
export function fillLegalPlaceholders(text: string): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => (isLegalKey(key) ? LEGAL[key] : match))
}
