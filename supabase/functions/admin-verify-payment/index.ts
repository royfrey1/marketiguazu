// ============================================================
// admin-verify-payment — verificación manual de un pago (admin)
//
// Plan B mientras las notificaciones automáticas de Mercado Pago
// no llegan: el admin hace clic en "Verificar pago" y esta función
// ejecuta EXACTAMENTE lo que haría mp-webhook si funcionara:
//
//   1. GET del pago a la API de MP (por provider_payment_id, o
//      búsqueda por external_reference si todavía no lo tenemos)
//   2. mapeo de estado (MP_STATUS_MAP compartida con mp-webhook)
//   3. RPC apply_mp_payment_status (la misma, service_role)
//   4. respuesta con el resultado para mostrar en el admin
//
// Seguridad: a diferencia de mp-webhook, requiere JWT válido
// (verify_jwt por defecto) y verifica is_admin() antes de tocar
// nada — esto lo llama un humano autenticado, no Mercado Pago.
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  applyMpPaymentStatus,
  fetchMpPaymentById,
  fetchMpPaymentByExternalReference,
  mapMpStatus,
  type MpPayment,
} from "../_shared/mp-payment.ts";

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
    console.error("admin-verify-payment: is_admin falló", adminError.message);
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
  // 4. orden + fila de pago
  // ----------------------------------------------------------
  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) {
    console.error("admin-verify-payment: order query falló", orderError.message);
    return errResp("INTERNAL_ERROR", "No se pudo leer el pedido", 500);
  }
  if (!order) {
    return errResp("ORDER_NOT_FOUND", "Pedido no encontrado", 404);
  }

  if (order.payment_status !== "pending") {
    return jsonResp({
      success: true,
      outcome: "already_final",
      message: `El pago ya está en "${order.payment_status}" — no hay nada que verificar.`,
      orderStatus: order.status,
      paymentStatus: order.payment_status,
    });
  }

  const { data: paymentRow, error: paymentError } = await service
    .from("payments")
    .select("id, provider_payment_id, status, amount")
    .eq("order_id", orderId)
    .eq("provider", "mercadopago")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paymentError) {
    console.error("admin-verify-payment: payments query falló", paymentError.message);
    return errResp("INTERNAL_ERROR", "No se pudo leer el pago", 500);
  }
  if (!paymentRow) {
    return errResp(
      "NO_PAYMENT_ROW",
      "El pedido no tiene un registro de pago asociado.",
      404,
    );
  }

  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) {
    return errResp(
      "MP_TOKEN_MISSING",
      "MERCADOPAGO_ACCESS_TOKEN no configurado",
      500,
    );
  }

  // ----------------------------------------------------------
  // 5. traer el estado real desde la API de MP
  // ----------------------------------------------------------
  let mpPayment: MpPayment;
  if (paymentRow.provider_payment_id) {
    const fetched = await fetchMpPaymentById(
      accessToken,
      paymentRow.provider_payment_id,
    );
    if (!fetched.ok) {
      if (fetched.notFound) {
        return jsonResp({
          success: false,
          outcome: "not_found",
          message: "Mercado Pago no devuelve ese pago (404).",
        });
      }
      console.error(
        "admin-verify-payment: GET payment falló",
        fetched.status,
        fetched.error,
      );
      return errResp("MP_FETCH_FAILED", "No se pudo consultar Mercado Pago", 502);
    }
    mpPayment = fetched.payment;
  } else {
    const fetched = await fetchMpPaymentByExternalReference(
      accessToken,
      String(orderId),
    );
    if (!fetched.ok) {
      console.error(
        "admin-verify-payment: search falló",
        fetched.status,
        fetched.error,
      );
      return errResp("MP_FETCH_FAILED", "No se pudo consultar Mercado Pago", 502);
    }
    if (!fetched.payment) {
      return jsonResp({
        success: false,
        outcome: "not_found",
        message: "No se encontró ningún pago en Mercado Pago para este pedido.",
      });
    }
    mpPayment = fetched.payment;
  }

  // el pago consultado debe corresponder a ESTA orden
  if (
    mpPayment.external_reference != null &&
    String(mpPayment.external_reference) !== String(orderId)
  ) {
    return errResp(
      "REFERENCE_MISMATCH",
      "El pago encontrado corresponde a otro pedido.",
      409,
    );
  }

  // ----------------------------------------------------------
  // 6. mapear estado + aplicar con la MISMA RPC del webhook
  // ----------------------------------------------------------
  const rawStatus = String(mpPayment.status);
  const mappedStatus = mapMpStatus(rawStatus);
  if (!mappedStatus) {
    return jsonResp({
      success: false,
      outcome: "unknown_status",
      message: `Estado desconocido de Mercado Pago: ${rawStatus}.`,
    });
  }

  const { result, error: rpcError } = await applyMpPaymentStatus(
    service,
    mpPayment,
    mappedStatus,
  );
  if (rpcError) {
    console.error("admin-verify-payment: RPC falló", rpcError);
    return errResp("RPC_FAILED", "No se pudo aplicar el estado del pago", 500);
  }
  if (!result) {
    return errResp("RPC_EMPTY", "La verificación no devolvió resultado", 500);
  }

  // ----------------------------------------------------------
  // 7. resultado legible para el admin
  // ----------------------------------------------------------
  const fresh = await service
    .from("orders")
    .select("status, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  const finalOrder = fresh.data ?? null;

  let success = true;
  let outcome = "applied";
  let message: string;

  switch (result.reason) {
    case "applied":
      message = mappedStatus === "approved"
        ? `Pago verificado y aplicado: aprobado. Pedido pasado a pagado.`
        : `Pago verificado y aplicado: ${mappedStatus} (MP: ${rawStatus}).`;
      break;
    case "order_cancelled_late_payment":
      success = false;
      outcome = "attention";
      message =
        "Mercado Pago acreditó un pago sobre un pedido cancelado — requiere atención manual (reembolso).";
      break;
    case "amount_mismatch":
      success = false;
      outcome = "amount_mismatch";
      message = `El monto de Mercado Pago (${
        String(result.mp_amount ?? "?")
      }) no coincide con el del pedido (${
        String(result.expected_amount ?? "?")
      }) — no se aplicó.`;
      break;
    case "same_status":
      outcome = "same_status";
      message = `Sin cambios: el pago ya estaba en "${result.payment_status ?? mappedStatus}".`;
      break;
    case "payment_row_not_found":
      success = false;
      outcome = "not_found";
      message = "No se encontró un pago pendiente en la base para este pedido.";
      break;
    case "ignored_transition":
      success = false;
      outcome = "ignored_transition";
      message = `Transición ignorada: ${String(result.from ?? "?")} → ${
        String(result.to ?? "?")
      }.`;
      break;
    default:
      message = `Resultado: ${String(result.reason ?? "sin razón")}.`;
      break;
  }

  return jsonResp({
    success,
    outcome,
    message,
    mpStatus: rawStatus,
    mappedStatus,
    providerPaymentId: String(mpPayment.id),
    orderStatus: finalOrder?.status ?? order.status,
    paymentStatus: finalOrder?.payment_status ?? order.payment_status,
    reason: result.reason ?? null,
    stockErrors: result.stock_errors ?? [],
  });
});
