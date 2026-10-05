const rawWhatsAppUrl = ((import.meta.env.VITE_WHATSAPP_URL as string | undefined) ?? '').trim()

/** Link de WhatsApp de atención, o '' si VITE_WHATSAPP_URL no está definido o no es un link de WhatsApp. */
export const whatsappUrl = /^(https:\/\/(wa\.me|api\.whatsapp\.com|whatsapp\.com)\/).*/i.test(rawWhatsAppUrl)
  ? rawWhatsAppUrl
  : ''
