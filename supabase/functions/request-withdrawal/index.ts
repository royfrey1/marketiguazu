// ============================================================
// Edge Function: request-withdrawal
// ============================================================
// Botón de arrepentimiento (Res. 424/2020): el comprador pide
// arrepentirse de un pedido con pago confirmado y recibe una
// constancia numerada (ARR-000001).
//
// Pública (--no-verify-jwt): también la usa quien no tiene sesión,
// identificándose por email de la cuenta.
//
// Identidad:
//   - Con JWT de usuario válido: debe ser el dueño del pedido
//     (se ignora el email del body).
//   - Sin sesión válida: se exige email y se compara (trim,
//     case-insensitive) con auth.users.email del dueño.
//
// Anti-enumeración: pedido inexistente, ajeno o email que no
// coincide devuelven SIEMPRE el mismo 404 genérico.
//
// NO toca pedidos, pagos ni stock: cancelación y reembolso los
// gestiona el admin a mano. Inserta con service role (no hay
// policies de INSERT en la tabla).
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { notifyNtfy } from "../_shared/notify-ntfy.ts";
import { sendEmail } from "../_shared/email.ts";

// Orígenes permitidos para CORS (mismo patrón que create-payment):
// la función maneja headers de auth, nada de "*".
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    "https://market-iguazu.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    Deno.env.get("SITE_URL"),
  ].filter((origin): origin is string => !!origin)
);

function buildCorsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

type ErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_ORDER_ITEMS"
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_ELIGIBLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

// Único 404: pedido inexistente, ajeno o email que no coincide
// (nunca se revela cuál de las condiciones falló).
const ORDER_NOT_FOUND_MESSAGE =
  "No encontramos un pedido con esos datos. Revisá el número de pedido y el email de tu cuenta.";

const ORDER_NOT_ELIGIBLE_MESSAGE =
  "Este pedido todavía no tiene un pago confirmado o ya fue cancelado. Si querés cancelarlo, escribinos por WhatsApp o email.";

const RATE_LIMIT_MESSAGE =
  "Ya hiciste varias solicitudes en poco tiempo. Esperá unos minutos y volvé a intentar.";

const OPEN_STATUSES = ["received", "in_progress"] as const;
const MAX_ITEMS = 50;
const MAX_REQUESTS_PER_HOUR = 5;
const DEADLINE_MS = 10 * 24 * 60 * 60 * 1000; // 10 días

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

serve(async (req: Request): Promise<Response> => {
  const cors = buildCorsHeaders(req);

  function jsonResp(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  // Errores con el shape plano { code, message } (contrato del front)
  function errResp(code: ErrorCode, message: string, status = 400): Response {
    return jsonResp({ code, message }, status);
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return errResp("INVALID_PAYLOAD", "Método no permitido", 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ----------------------------------------------------------
    // 1. payload: parse + validación/saneo de todo
    // ----------------------------------------------------------
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errResp("INVALID_PAYLOAD", "Body de request inválido");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errResp("INVALID_PAYLOAD", "Body de request inválido");
    }

    const orderNumero =
      typeof body.order_numero === "string" ? body.order_numero.trim() : "";
    if (!orderNumero || orderNumero.length > 60) {
      return errResp(
        "INVALID_PAYLOAD",
        "Falta el número de pedido (order_numero)."
      );
    }

    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (nombre.length < 2 || nombre.length > 120) {
      return errResp(
        "INVALID_PAYLOAD",
        "El nombre debe tener entre 2 y 120 caracteres."
      );
    }

    let bodyEmail: string | null = null;
    if (body.email !== undefined && body.email !== null) {
      if (typeof body.email !== "string" || !isValidEmail(body.email.trim())) {
        return errResp("INVALID_PAYLOAD", "El email no tiene un formato válido.");
      }
      bodyEmail = body.email.trim().toLowerCase();
    }

    let orderItemIds: number[] | null = null;
    if (body.order_item_ids !== undefined && body.order_item_ids !== null) {
      const raw = body.order_item_ids;
      if (!Array.isArray(raw) || raw.length > MAX_ITEMS) {
        return errResp(
          "INVALID_PAYLOAD",
          `order_item_ids debe ser un array de a lo sumo ${MAX_ITEMS} enteros.`
        );
      }
      if (!raw.every((v) => Number.isInteger(v) && (v as number) > 0)) {
        return errResp(
          "INVALID_PAYLOAD",
          "order_item_ids debe contener solo enteros positivos."
        );
      }
      orderItemIds = raw as number[];
    }

    let motivo: string | null = null;
    if (body.motivo !== undefined && body.motivo !== null) {
      if (typeof body.motivo !== "string") {
        return errResp("INVALID_PAYLOAD", "El motivo debe ser un texto.");
      }
      motivo = body.motivo.trim();
      if (motivo.length > 500) {
        return errResp(
          "INVALID_PAYLOAD",
          "El motivo no puede superar los 500 caracteres."
        );
      }
      if (!motivo) motivo = null;
    }

    // ----------------------------------------------------------
    // 2. identidad + pedido (anti-enumeración)
    // ----------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || "";

    let sessionUserId: string | null = null;
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) sessionUserId = data.user.id;
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, numero_pedido, user_id, status, payment_status, created_at, updated_at"
      )
      .eq("numero_pedido", orderNumero)
      .limit(1)
      .maybeSingle();

    if (orderErr) {
      console.error("request-withdrawal: lookup de pedido falló", orderErr.code);
      return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
    }

    // Email de la cuenta dueña (auth.users.email: profiles no tiene email)
    let ownerEmail = "";
    if (order) {
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(
          order.user_id
        );
        ownerEmail = authData.user?.email?.trim().toLowerCase() ?? "";
      } catch (error) {
        console.error(
          "request-withdrawal: no se pudo obtener el email del dueño",
          error
        );
      }
    }

    const notFound = (): Response =>
      errResp("ORDER_NOT_FOUND", ORDER_NOT_FOUND_MESSAGE, 404);

    // Pedido inexistente, o sin email de cuenta -> 404 genérico
    if (!order || !ownerEmail) return notFound();

    if (sessionUserId) {
      // Con sesión válida: debe ser el dueño (el email del body se ignora)
      if (sessionUserId !== order.user_id) return notFound();
    } else {
      // Sin sesión válida: email obligatorio y debe coincidir
      if (bodyEmail === null) {
        return errResp(
          "INVALID_PAYLOAD",
          "Sin sesión necesitamos el email de tu cuenta para verificar el pedido."
        );
      }
      if (bodyEmail !== ownerEmail) return notFound();
    }

    // ----------------------------------------------------------
    // 3. elegibilidad: pago aprobado y no cancelado
    // ----------------------------------------------------------
    if (order.payment_status !== "approved" || order.status === "cancelled") {
      return errResp("ORDER_NOT_ELIGIBLE", ORDER_NOT_ELIGIBLE_MESSAGE, 422);
    }

    // ----------------------------------------------------------
    // 4. order_item_ids (si viene) debe ser del pedido
    // ----------------------------------------------------------
    if (orderItemIds) {
      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select("id")
        .eq("order_id", order.id);
      if (itemsErr) {
        console.error(
          "request-withdrawal: lookup de items falló",
          itemsErr.code
        );
        return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
      }
      const valid = new Set((items ?? []).map((i) => i.id as number));
      if (orderItemIds.some((id) => !valid.has(id))) {
        return errResp(
          "INVALID_ORDER_ITEMS",
          "Los artículos indicados no pertenecen a este pedido."
        );
      }
    }

    // ----------------------------------------------------------
    // 5. ¿ya hay una solicitud abierta para este pedido?
    // ----------------------------------------------------------
    const { data: existing, error: existingErr } = await supabase
      .from("withdrawal_requests")
      .select("numero, numero_pedido, created_at, within_deadline")
      .eq("order_id", order.id)
      .in("status", [...OPEN_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error(
        "request-withdrawal: lookup de solicitud falló",
        existingErr.code
      );
      return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
    }

    if (existing) {
      return jsonResp({
        numero: existing.numero,
        numero_pedido: existing.numero_pedido,
        created_at: existing.created_at,
        within_deadline: existing.within_deadline,
        already_requested: true,
      });
    }

    // ----------------------------------------------------------
    // 6. rate limit: máx. 5 solicitudes por hora por usuario
    //    (consulta la propia tabla; no usa tablas externas)
    // ----------------------------------------------------------
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: countErr } = await supabase
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", order.user_id)
      .gte("created_at", oneHourAgo);

    if (countErr) {
      console.error(
        "request-withdrawal: count de solicitudes falló",
        countErr.code
      );
      return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
    }

    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return errResp("RATE_LIMITED", RATE_LIMIT_MESSAGE, 429);
    }

    // ----------------------------------------------------------
    // 7. within_deadline (solo informativo, NUNCA bloquea)
    //    delivered -> orders.updated_at; si no -> orders.created_at
    // ----------------------------------------------------------
    const reference =
      order.status === "delivered" ? order.updated_at : order.created_at;
    const withinDeadline = Date.now() <= Date.parse(reference) + DEADLINE_MS;

    // ----------------------------------------------------------
    // 8. insert con service role
    // ----------------------------------------------------------
    const { data: inserted, error: insertErr } = await supabase
      .from("withdrawal_requests")
      .insert({
        order_id: order.id,
        user_id: order.user_id,
        numero_pedido: order.numero_pedido,
        nombre,
        email: ownerEmail, // email de la cuenta (no el del body)
        order_item_ids: orderItemIds,
        motivo,
        within_deadline: withinDeadline,
      })
      .select("numero, numero_pedido, created_at, within_deadline")
      .single();

    if (insertErr) {
      // Carrera: otra request creó la abierta entre el paso 5 y acá
      // (índice parcial único idx_withdrawal_requests_open_per_order)
      if (insertErr.code === "23505") {
        const { data: race } = await supabase
          .from("withdrawal_requests")
          .select("numero, numero_pedido, created_at, within_deadline")
          .eq("order_id", order.id)
          .in("status", [...OPEN_STATUSES])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (race) {
          return jsonResp({
            numero: race.numero,
            numero_pedido: race.numero_pedido,
            created_at: race.created_at,
            within_deadline: race.within_deadline,
            already_requested: true,
          });
        }
      }
      console.error("request-withdrawal: insert falló", insertErr.code);
      return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
    }

    const { numero, numero_pedido, created_at } = inserted;

    // ----------------------------------------------------------
    // 9. notificaciones (best effort: nunca rompen la respuesta)
    // ----------------------------------------------------------
    try {
      await notifyNtfy(
        `Solicitud de arrepentimiento ${numero}: pedido ${numero_pedido} (${
          withinDeadline ? "dentro" : "FUERA"
        } del plazo de 10 días).`
      );
    } catch (error) {
      console.error("request-withdrawal: ntfy falló", error);
    }

    try {
      const fecha = new Intl.DateTimeFormat("es-AR", {
        dateStyle: "long",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(created_at));

      const sent = await sendEmail({
        to: ownerEmail,
        subject: `Constancia ${numero} de arrepentimiento — pedido ${numero_pedido}`,
        html: `
          <p>Hola,</p>
          <p>Recibimos tu solicitud de arrepentimiento del pedido
          <strong>#${numero_pedido}</strong> con la constancia
          <strong>${numero}</strong>, del ${fecha}.</p>
          <p>Te vamos a contactar para coordinar la devolución, que es
          sin costo para vos.</p>
          <p>Guardá este número de constancia: te va a servir para
          cualquier consulta.</p>
          <p>IGUAZU MARKETPLACE</p>
        `,
        text:
          `Hola,\n\n` +
          `Recibimos tu solicitud de arrepentimiento del pedido #${numero_pedido} ` +
          `con la constancia ${numero}, del ${fecha}.\n\n` +
          `Te vamos a contactar para coordinar la devolución, que es sin costo para vos.\n\n` +
          `Guardá este número de constancia: te va a servir para cualquier consulta.\n\n` +
          `IGUAZU MARKETPLACE\n`,
      });
      if (!sent) {
        // p.ej. Resend 403 por dominio sin verificar: solo se loguea
        console.error(
          "request-withdrawal: email de constancia no enviado (omitido)"
        );
      }
    } catch (error) {
      console.error(
        "request-withdrawal: error enviando email de constancia",
        error
      );
    }

    // ----------------------------------------------------------
    // 10. respuesta 200
    // ----------------------------------------------------------
    return jsonResp({
      numero,
      numero_pedido,
      created_at,
      within_deadline: withinDeadline,
      already_requested: false,
    });
  } catch (error) {
    console.error("request-withdrawal: error interno", error);
    return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
  }
});
