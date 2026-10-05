// ============================================================
// Edge Function: send-order-email
// ============================================================
// Admin-only: el panel admin la llama justo después de confirmar
// un pago manual (mercado de USDT o "Verificar pago" de MP) para
// avisarle al cliente por email.
//
// Recibe { orderId }, busca la orden, su payment más reciente
// (provider/metadata) y el email del cliente (auth.admin.getUserById,
// porque "profiles" no tiene columna email), y envía el email de
// confirmación con _shared/email.ts (Resend).
//
// Seguridad: mismo patrón que admin-verify-payment — JWT válido
// + is_admin() antes de tocar nada.
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
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

function providerLabel(provider: string | null): string | null {
  switch (provider) {
    case "mercadopago":
      return "Mercado Pago";
    case "usdt":
      return "USDT (TRC20)";
    default:
      return provider;
  }
}

serve(async (req: Request): Promise<Response> => {
  const cors = buildCorsHeaders(req);

  function jsonResp(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  function errResp(code: string, message: string, status = 400): Response {
    return jsonResp({ success: false, error: { code, message } }, status);
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return errResp("INVALID_METHOD", "Método no permitido", 405);
  }

  // ----------------------------------------------------------
  // 1. autenticación: JWT válido del caller
  // ----------------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errResp("AUTH_REQUIRED", "Token de autenticación requerido", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return errResp("AUTH_REQUIRED", "Usuario no autenticado", 401);
  }

  // ----------------------------------------------------------
  // 2. autorización: solo admin
  // ----------------------------------------------------------
  const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
  if (adminError) {
    console.error("send-order-email: is_admin falló", adminError.message);
    return errResp("ADMIN_CHECK_FAILED", "No se pudo verificar el rol", 500);
  }
  if (isAdmin !== true) {
    return errResp("FORBIDDEN", "Se requiere rol de administrador", 403);
  }

  // ----------------------------------------------------------
  // 3. payload
  // ----------------------------------------------------------
  let orderId: number;
  try {
    const payload = await req.json();
    orderId = payload?.orderId;
  } catch {
    return errResp("INVALID_PAYLOAD", "Body inválido");
  }
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return errResp("INVALID_PAYLOAD", "orderId inválido");
  }

  const service = createClient(supabaseUrl, serviceKey);

  // ----------------------------------------------------------
  // 4. orden + payment más reciente
  // ----------------------------------------------------------
  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id, numero_pedido, user_id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) {
    console.error("send-order-email: order query falló", orderError.message);
    return errResp("INTERNAL_ERROR", "No se pudo leer el pedido", 500);
  }
  if (!order) {
    return errResp("ORDER_NOT_FOUND", "Pedido no encontrado", 404);
  }

  if (order.payment_status !== "approved") {
    return errResp(
      "PAYMENT_NOT_APPROVED",
      "El pago de este pedido todavía no está aprobado",
      409
    );
  }

  const { data: payment } = await service
    .from("payments")
    .select("id, provider, status, amount, currency, metadata")
    .eq("order_id", orderId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ----------------------------------------------------------
  // 5. email del cliente (auth.admin, porque profiles no tiene email)
  // ----------------------------------------------------------
  const { data: custData, error: userErr } =
    await service.auth.admin.getUserById(order.user_id);
  const email = custData?.user?.email;
  if (userErr || !email) {
    console.error(
      "send-order-email: no se pudo obtener el email del cliente",
      userErr?.message
    );
    return errResp(
      "CUSTOMER_EMAIL_NOT_FOUND",
      "No se pudo obtener el email del cliente",
      422
    );
  }

  // ----------------------------------------------------------
  // 6. enviar email de confirmación
  // ----------------------------------------------------------
  const numero = order.numero_pedido ?? String(order.id);
  const metodo = payment ? providerLabel(payment.provider) : null;
  const monto =
    payment && payment.amount != null
      ? `$${payment.amount} ${payment.currency ?? "ARS"}`
      : null;

  const detallePago = metodo
    ? `<p>Método de pago: <strong>${metodo}</strong>${
        monto ? ` — monto confirmado: <strong>${monto}</strong>` : ""
      }.</p>`
    : "";

  const sent = await sendEmail({
    to: email,
    subject: `¡Tu pago fue confirmado! Pedido #${numero} ya está siendo preparado.`,
    html: `
      <p>Hola,</p>
      <p><strong>¡Tu pago fue confirmado!</strong></p>
      <p>El pedido <strong>#${numero}</strong> ya está siendo preparado.</p>
      ${detallePago}
      <p>Te vamos a avisar cuando salga para entrega.</p>
      <p>Gracias por tu compra.<br>IGUAZU MARKETPLACE</p>
    `,
    text:
      `Hola,\n\n¡Tu pago fue confirmado!\n\n` +
      `El pedido #${numero} ya está siendo preparado.\n` +
      (metodo
        ? `Método de pago: ${metodo}${monto ? ` — monto confirmado: ${monto}` : ""}.\n`
        : "") +
      `\nTe vamos a avisar cuando salga para entrega.\n\nGracias por tu compra.\nIGUAZU MARKETPLACE\n`,
  });

  if (!sent) {
    console.error("send-order-email: el email no pudo enviarse", {
      orderId,
      email,
    });
  }

  return jsonResp({ success: true, emailSent: sent });
});
