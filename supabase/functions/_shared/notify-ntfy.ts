// ============================================================
// _shared/notify-ntfy.ts — notificación push vía ntfy.sh
// ============================================================
// POST de texto plano a https://ntfy.sh/<topic>.
//
// El topic viene de la variable de entorno NTFY_TOPIC.
// ntfy.sh es un servicio PÚBLICO: cualquiera que conozca el topic
// puede suscribirse, por eso el topic debe ser largo y no adivinable.
//
// Si falla, solo se loguea: NUNCA debe romper el flujo que lo llama.
// ============================================================

export async function notifyNtfy(message: string): Promise<void> {
  const topic = Deno.env.get("NTFY_TOPIC")?.trim();
  if (!topic) {
    console.error("notify-ntfy: NTFY_TOPIC no configurada, notificación omitida");
    return;
  }

  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: message,
    });
    if (!res.ok) {
      console.error("notify-ntfy: HTTP", res.status, await res.text());
    }
  } catch (error) {
    console.error("notify-ntfy: error", error);
  }
}
