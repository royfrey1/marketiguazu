// ============================================================
// _shared/email.ts — envío de emails transaccionales (Resend)
// ============================================================
// Wrapper mínimo sobre la API de Resend (https://api.resend.com/emails).
//
// Variables de entorno:
//   RESEND_API_KEY    API key de Resend
//   RESEND_FROM_EMAIL remitente verificado en Resend
//
// Si falta la configuración o el envío falla, solo se loguea:
// NUNCA debe romper el flujo principal que lo llama (devuelve false).
// ============================================================

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Devuelve true si Resend aceptó el email; false si no se pudo enviar. */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim();

  if (!apiKey || !from) {
    console.error(
      "email: RESEND_API_KEY / RESEND_FROM_EMAIL no configuradas, email omitido"
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });

    if (!res.ok) {
      console.error("email: HTTP", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("email: error", error);
    return false;
  }
}
