// ============================================================
// Edge Function: create-payment-usdt
// ============================================================
// Método de pago alternativo: transferencia USDT (red TRC20) con
// verificación manual por el admin (notificación push + email).
//
// Flujo:
//   1-8. orden pending + order_items + reserva de stock
//        (compartido con create-payment, _shared/order-creation.ts)
//   9.  cotización ARS -> USDT en vivo (CriptoYa)
//   10. monto en USDT = total ARS / cotización (2 decimales)
//   11. registro en payments (provider='usdt', status='pending')
//   12. notificación push al admin (ntfy) + email al cliente
//   13. respuesta con datos de la transferencia
//
// Si algo falla después de reservar stock, se liberan las reservas
// (mismo patrón que create-payment con release_reservation).
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  createPendingOrder,
  releaseReservedItems,
  type CreateOrderPayload,
  type OrderErrorCode,
} from "../_shared/order-creation.ts";
import { notifyNtfy } from "../_shared/notify-ntfy.ts";
import { sendEmail } from "../_shared/email.ts";

// ============================================================
// constantes
// ============================================================

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

const NETWORK = "TRC20";

type ErrorCode =
  | OrderErrorCode
  | "PAYMENT_CREATION_FAILED"
  | "EXCHANGE_RATE_ERROR"
  | "WALLET_NOT_CONFIGURED"
  | "INTERNAL_ERROR";

// ============================================================
// cotización ARS -> USDT (en vivo, sin API key)
// ============================================================
// Confirmado con curl contra el endpoint real:
//   GET https://criptoya.com/api/dolar
//     -> { cripto: { usdt: { ask, bid, variation, timestamp }, ... } }
//   fallback GET https://criptoya.com/api/binance/USDT/ARS/1
//     -> { ask, totalAsk, bid, totalBid, time }
//
// Se usa `bid` (precio al que el que recibe USDT puede venderlas):
// es conservador para el vendedor — el cliente transfiere un poco
// más de USDT y el total ARS queda cubierto.

async function fetchUsdtRate(): Promise<number | null> {
  try {
    const res = await fetch("https://criptoya.com/api/dolar");
    if (res.ok) {
      const data = await res.json();
      const bid = Number(data?.cripto?.usdt?.bid);
      if (Number.isFinite(bid) && bid > 0) return bid;
      console.error("create-payment-usdt: cripto.usdt.bid inválido", bid);
    } else {
      console.error("create-payment-usdt: /api/dolar HTTP", res.status);
    }
  } catch (error) {
    console.error("create-payment-usdt: /api/dolar error", error);
  }

  try {
    const res = await fetch("https://criptoya.com/api/binance/USDT/ARS/1");
    if (res.ok) {
      const data = await res.json();
      const bid = Number(data?.bid);
      if (Number.isFinite(bid) && bid > 0) return bid;
      console.error("create-payment-usdt: binance bid inválido", bid);
    } else {
      console.error("create-payment-usdt: /api/binance HTTP", res.status);
    }
  } catch (error) {
    console.error("create-payment-usdt: /api/binance error", error);
  }

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================
// handler principal
// ============================================================

serve(async (req: Request): Promise<Response> => {
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

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return errResp("INVALID_PAYLOAD", "Método no permitido", 405);
  }

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
    const walletAddress = Deno.env.get("USDT_WALLET_ADDRESS")?.trim();

    if (!walletAddress) {
      return errResp(
        "WALLET_NOT_CONFIGURED",
        "Variable de entorno USDT_WALLET_ADDRESS no configurada",
        500
      );
    }

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
    //      (compartido con create-payment)
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

    const { userId, orderId, numeroPedido, total, reservedItems } = order;
    const numero = numeroPedido ?? String(orderId);

    // ----------------------------------------------------------
    // 9. cotización ARS -> USDT en vivo
    // ----------------------------------------------------------
    const rate = await fetchUsdtRate();
    if (!rate) {
      await releaseReservedItems(supabase, orderId, reservedItems);
      return errResp(
        "EXCHANGE_RATE_ERROR",
        "No se pudo obtener la cotización de USDT",
        502
      );
    }

    const exchangeRate = round2(rate);
    const amountUsdt = round2(total / rate);

    // ----------------------------------------------------------
    // 10. registro de pago pendiente (provider='usdt')
    //     (mismo patrón select-then-update-or-insert que
    //      create-payment con provider='mercadopago')
    // ----------------------------------------------------------
    const metadata = {
      amount_usdt: amountUsdt,
      exchange_rate: exchangeRate,
      wallet_address: walletAddress,
      network: NETWORK,
    };

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .eq("provider", "usdt")
      .maybeSingle();

    if (existingPayment) {
      const { error: updErr } = await supabase
        .from("payments")
        .update({
          amount: total,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPayment.id);

      if (updErr) {
        await releaseReservedItems(supabase, orderId, reservedItems);
        console.error(
          "create-payment-usdt: update de pago falló",
          updErr.message
        );
        return errResp(
          "PAYMENT_CREATION_FAILED",
          "Error al crear registro de pago",
          500
        );
      }
    } else {
      const { error: payErr } = await supabase
        .from("payments")
        .insert({
          order_id: orderId,
          provider: "usdt",
          status: "pending",
          amount: total,
          currency: "ARS",
          metadata,
        });

      if (payErr) {
        await releaseReservedItems(supabase, orderId, reservedItems);
        console.error(
          "create-payment-usdt: insert de pago falló",
          payErr.message
        );
        return errResp(
          "PAYMENT_CREATION_FAILED",
          "Error al crear registro de pago",
          500
        );
      }
    }

    // ----------------------------------------------------------
    // 11. notificación push al admin (nunca rompe el flujo)
    // ----------------------------------------------------------
    await notifyNtfy(
      `Nuevo pedido #${numero} quiere pagar con USDT: $${total} (≈ ${amountUsdt} USDT). Revisá tu wallet y confirmá en el panel admin cuando llegue.`
    );

    // ----------------------------------------------------------
    // 12. email al cliente (nunca rompe el flujo)
    // ----------------------------------------------------------
    try {
      const { data: authData, error: userErr } =
        await supabase.auth.admin.getUserById(userId);
      const email = authData?.user?.email;

      if (userErr || !email) {
        console.error(
          "create-payment-usdt: no se pudo obtener el email del cliente",
          userErr?.message
        );
      } else {
        await sendEmail({
          to: email,
          subject: `Tu pedido #${numero} está pendiente de confirmación`,
          html: `
            <p>Hola,</p>
            <p>Tu pedido <strong>#${numero}</strong> quedó registrado y está
            <strong>pendiente de confirmación</strong>.</p>
            <p>Para pagarlo, transferí <strong>${amountUsdt} USDT (red ${NETWORK})</strong>
            a esta dirección:</p>
            <p><code>${walletAddress}</code></p>
            <p>Equivalente: <strong>$${total} ARS</strong> (cotización
            ${exchangeRate} ARS/USDT).</p>
            <p>Tenés 24 horas para realizar la transferencia: pasado ese
            plazo el pedido se cancela automáticamente.</p>
            <p>Cuando recibamos la transferencia, te vamos a confirmar por
            email en las próximas horas.</p>
            <p>Gracias por tu compra.<br>IGUAZU MARKETPLACE</p>
          `,
          text:
            `Hola,\n\nTu pedido #${numero} quedó registrado y está pendiente de confirmación.\n\n` +
            `Para pagarlo, transferí ${amountUsdt} USDT (red ${NETWORK}) a esta dirección:\n` +
            `${walletAddress}\n\n` +
            `Equivalente: $${total} ARS (cotización ${exchangeRate} ARS/USDT).\n\n` +
            `Tenés 24 horas para realizar la transferencia: pasado ese plazo el pedido se cancela automáticamente.\n\n` +
            `Cuando recibamos la transferencia, te vamos a confirmar por email en las próximas horas.\n\n` +
            `Gracias por tu compra.\nIGUAZU MARKETPLACE\n`,
        });
      }
    } catch (error) {
      console.error("create-payment-usdt: error enviando email al cliente", error);
    }

    // ----------------------------------------------------------
    // 13. respuesta exitosa
    // ----------------------------------------------------------
    return jsonResp({
      success: true,
      orderId,
      orderNumber: numeroPedido,
      amountArs: total,
      amountUsdt,
      exchangeRate,
      walletAddress,
      network: NETWORK,
    });
  } catch (error) {
    console.error("Error interno:", error);
    return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
  }
});
