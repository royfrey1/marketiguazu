// ============================================================
// F7 T2.2 — Edge Function: create-payment
// ============================================================
// Crea o reutiliza una order pending, reserva stock, genera
// una Preferencia de Mercado Pago y devuelve init_point.
//
// Los pasos 1-8 (auth, validaciones, orden, order_items y
// reserva de stock) viven en _shared/order-creation.ts y son
// compartidos con create-payment-usdt. Acá se agrega lo propio
// de Mercado Pago: registro de pago + Preferencia.
//
// Envío: siempre gratis y fijo a Correo Argentino.
//   envio_costo = 0, total = subtotal,
//   metodo_envio = 'correo_argentino' (server-side, sin depender del body).
//   No se llama a create-quote (cuenta de Correo Argentino sin habilitar).
//
// NO implementa webhook ni confirmación de pago.
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  createPendingOrder,
  releaseReservedItems,
  type CreateOrderPayload,
  type OrderErrorCode,
} from "../_shared/order-creation.ts";

// ============================================================
// constantes
// ============================================================

// Orígenes permitidos para CORS. No se usa "*": la función maneja
// headers de auth, por lo que cada origin debe estar en la lista blanca.
// (SITE_URL solo se agrega acá como dominio configurado; su uso principal
// sigue siendo las back_urls de Mercado Pago.)
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    "https://market-iguazu.vercel.app", // producción (Vercel)
    "http://localhost:5173", // Vite dev server
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

const MP_API_URL = "https://api.mercadopago.com/checkout/preferences";

// ============================================================
// tipos
// ============================================================

type ErrorCode =
  | OrderErrorCode
  | "PAYMENT_CREATION_FAILED"
  | "MERCADOPAGO_ERROR"
  | "INTERNAL_ERROR";

// ============================================================
// handler principal
// ============================================================

serve(async (req: Request): Promise<Response> => {
  // CORS por request: refleja el Origin SOLO si está en la lista blanca.
  // Todas las respuestas (éxito, error y preflight) salen por acá.
  const cors = buildCorsHeaders(req);

  function jsonResp(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  function errResp(code: ErrorCode, message: string, status = 400): Response {
    return jsonResp({ success: false, error: { code, message } }, status);
  }

  // preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return errResp("INVALID_PAYLOAD", "Método no permitido", 405);
  }

  // Reservas a liberar si algo falla DESPUÉS de crear la orden y
  // ANTES de la respuesta exitosa. Las ramas de error explícitas
  // (PAYMENT_CREATION_FAILED, MERCADOPAGO_ERROR) y el catch externo
  // consumen esta única referencia: se anula ANTES de esperar la
  // llamada para no liberar dos veces (la idempotencia neta de
  // release_reservation protege igual, pero no se repiten llamadas
  // innecesarias).
  let pendingRelease: (() => Promise<void>) | null = null;
  const releaseOnce = (): Promise<void> => {
    if (!pendingRelease) return Promise.resolve();
    const release = pendingRelease;
    pendingRelease = null;
    return release();
  };

  try {
    // ----------------------------------------------------------
    // 1. autenticación (presencia del header) + env
    // ----------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errResp("AUTH_REQUIRED", "Token de autenticación requerido", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const siteUrl = Deno.env.get("SITE_URL") || "https://market-iguazu.vercel.app";

    if (!mpAccessToken) {
      return errResp(
        "INTERNAL_ERROR",
        "Variable de entorno MERCADOPAGO_ACCESS_TOKEN no configurada",
        500
      );
    }

    // cliente con service role puro (bypass RLS en todo el REST;
    // el JWT del usuario se pasa explícito solo a getUser)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    // ----------------------------------------------------------
    // 2. validar payload
    // ----------------------------------------------------------
    let payload: CreateOrderPayload;
    try {
      payload = await req.json();
    } catch {
      return errResp("INVALID_PAYLOAD", "Body de request inválido");
    }

    // ----------------------------------------------------------
    // 3-8. orden pending + order_items + reserva de stock
    //      (compartido con create-payment-usdt)
    // ----------------------------------------------------------
    const order = await createPendingOrder(supabase, token, payload);
    if (!order.success) {
      if (order.orderId != null) {
        return jsonResp(
          {
            success: false,
            error: { code: order.code, message: order.message },
            orderId: order.orderId,
          },
          order.status
        );
      }
      return errResp(order.code, order.message, order.status);
    }

    const { orderId, numeroPedido, total, validatedItems, reservedItems } = order;
    pendingRelease = () => releaseReservedItems(supabase, orderId, reservedItems);

    // ----------------------------------------------------------
    // 9. crear payment pendiente
    // ----------------------------------------------------------
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .eq("provider", "mercadopago")
      .maybeSingle();

    let paymentId: number;

    if (existingPayment) {
      paymentId = existingPayment.id;
      await supabase
        .from("payments")
        .update({ amount: total, updated_at: new Date().toISOString() })
        .eq("id", paymentId);
    } else {
      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          order_id: orderId,
          provider: "mercadopago",
          status: "pending",
          amount: total,
          currency: "ARS",
        })
        .select("id")
        .single();

      if (payErr || !payment) {
        await releaseOnce();
        return errResp(
          "PAYMENT_CREATION_FAILED",
          "Error al crear registro de pago",
          500
        );
      }
      paymentId = payment.id;
    }

    // ----------------------------------------------------------
    // 10. crear Preferencia de Mercado Pago
    // ----------------------------------------------------------
    const mpItems = validatedItems.map((item) => ({
      id: String(item.productId),
      title: item.title,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      currency_id: "ARS",
    }));

    const preferenceBody = {
      items: mpItems,
      external_reference: String(orderId),
      metadata: {
        order_id: String(orderId),
        payment_id: String(paymentId),
      },
      back_urls: {
        success: `${siteUrl}/pago/exito?order=${orderId}`,
        failure: `${siteUrl}/pago/fallo?order=${orderId}`,
        pending: `${siteUrl}/pago/pendiente?order=${orderId}`,
      },
      auto_return: "approved",
      statement_descriptor: "IGUAZU MARKETPLACE",
      expires: true,
      expiration_date_to: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    const mpResponse = await fetch(MP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preferenceBody),
      // Timeout para no dejar el isolate colgado con la reserva
      // activa: un timeout lanza excepción -> catch externo -> libera.
      signal: AbortSignal.timeout(10000),
    });

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text();

      await releaseOnce();

      console.error("Mercado Pago error:", mpResponse.status, mpError);

      return errResp(
        "MERCADOPAGO_ERROR",
        `Error al crear preferencia de pago (${mpResponse.status})`,
        502
      );
    }

    const preference = await mpResponse.json();

    // guardar preference_id en payment metadata
    await supabase
      .from("payments")
      .update({
        metadata: { preference_id: preference.id },
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    // ----------------------------------------------------------
    // 11. respuesta exitosa (orden, pago y preferencia hechos:
    //     no queda nada por liberar)
    // ----------------------------------------------------------
    pendingRelease = null;
    return jsonResp({
      success: true,
      orderId,
      orderNumber: numeroPedido,
      initPoint: preference.init_point,
    });
  } catch (error) {
    console.error("Error interno:", error);
    // Excepción no manejada después de crear la orden (payments,
    // preferencia MP, respuesta): liberar reservas para no dejar
    // stock reservado sin proceso que lo sostenga. releaseOnce
    // evita duplicar si una rama de error explícita ya liberó.
    if (pendingRelease) {
      try {
        await releaseOnce();
      } catch (releaseError) {
        console.error(
          "create-payment: liberación de reservas falló en el catch externo",
          releaseError
        );
      }
    }
    return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
  }
});
