// ============================================================
// Edge Function: create-payment-transfer
// ============================================================
// Método de pago alternativo: transferencia bancaria en ARS con
// verificación manual por el admin (mismo esquema que USDT).
//
// Flujo:
//   1-8. orden pending + order_items + reserva de stock
//        (compartido con create-payment, _shared/order-creation.ts)
//   9.  registro en payments (provider='transfer', status='pending',
//       amount = total ARS, metadata con alias/cbu/titular/banco y
//       la referencia = número de pedido)
//   10. notificación push al admin (ntfy) + email al cliente
//   11. respuesta con los datos para transferir el total exacto
//
// Precio de contado: sin recargo (amount = total publicado).
// Plazo: 24 horas; expire_stale_pending_orders cancela los
// pendientes viejos (no se modifica acá).
//
// Secrets requeridos: TRANSFER_TITULAR y al menos uno de
// TRANSFER_ALIAS / TRANSFER_CBU (opcional: TRANSFER_BANCO).
// Si faltan, TRANSFER_NOT_CONFIGURED (500) ANTES de crear la
// orden o reservar stock (mismo patrón que WALLET_NOT_CONFIGURED
// en create-payment-usdt).
//
// Si algo falla después de reservar stock, se liberan las
// reservas (mismo patrón que create-payment con release_reservation).
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

// Plazo de pago para transferir (horas). Después de ese plazo el
// cron expire_stale_pending_orders cancela el pedido pendiente.
const PAYMENT_WINDOW_HOURS = 24;

type ErrorCode =
  | OrderErrorCode
  | "PAYMENT_CREATION_FAILED"
  | "TRANSFER_NOT_CONFIGURED"
  | "INTERNAL_ERROR";

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

  // Reservas a liberar si algo falla DESPUÉS de crear la orden y
  // ANTES de la respuesta exitosa (mismo patrón que
  // create-payment-usdt: releaseOnce evita liberar dos veces).
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

    const titular = Deno.env.get("TRANSFER_TITULAR")?.trim();
    const alias = Deno.env.get("TRANSFER_ALIAS")?.trim() || undefined;
    const cbu = Deno.env.get("TRANSFER_CBU")?.trim() || undefined;
    const banco = Deno.env.get("TRANSFER_BANCO")?.trim() || undefined;

    // Requeridos: titular y al menos uno de alias/cbu. Se valida
    // ANTES de crear la orden o reservar stock.
    if (!titular || (!alias && !cbu)) {
      return errResp(
        "TRANSFER_NOT_CONFIGURED",
        "Faltan secrets de transferencia (TRANSFER_TITULAR y al menos TRANSFER_ALIAS o TRANSFER_CBU)",
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
    pendingRelease = () => releaseReservedItems(supabase, orderId, reservedItems);

    // ----------------------------------------------------------
    // 9. registro de pago pendiente (provider='transfer')
    //    Precio de contado: amount = total ARS (sin recargo).
    //    metadata: solo claves configuradas (alias/cbu/banco
    //    opcionales) + referencia = número de pedido.
    //    (mismo patrón select-then-update-or-insert que
    //     create-payment con provider='mercadopago')
    // ----------------------------------------------------------
    const metadata: Record<string, string> = { titular };
    if (alias) metadata.alias = alias;
    if (cbu) metadata.cbu = cbu;
    if (banco) metadata.banco = banco;
    metadata.referencia = numero;

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .eq("provider", "transfer")
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
        await releaseOnce();
        console.error(
          "create-payment-transfer: update de pago falló",
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
          provider: "transfer",
          status: "pending",
          amount: total,
          currency: "ARS",
          metadata,
        });

      if (payErr) {
        await releaseOnce();
        console.error(
          "create-payment-transfer: insert de pago falló",
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
    // 10. notificación push al admin (nunca rompe el flujo)
    //     Sin datos personales ni datos bancarios.
    // ----------------------------------------------------------
    await notifyNtfy(
      `Nuevo pedido #${numero} quiere pagar por transferencia: $${total}. Revisa tu cuenta y confirma en el panel admin cuando llegue.`
    );

    // ----------------------------------------------------------
    // 11. email al cliente (best effort, nunca rompe el flujo)
    //     Pedido pendiente + titular + alias/cbu + total exacto +
    //     número de pedido como concepto + plazo de 24 horas.
    //     Resend puede fallar con 403 (dominio sin verificar): solo
    //     se loguea.
    // ----------------------------------------------------------
    try {
      const { data: authData, error: userErr } =
        await supabase.auth.admin.getUserById(userId);
      const email = authData?.user?.email;

      if (userErr || !email) {
        console.error(
          "create-payment-transfer: no se pudo obtener el email del cliente",
          userErr?.message
        );
      } else {
        const datosCuenta = [banco && `<p>Banco: <strong>${banco}</strong></p>`,
          `<p>Titular: <strong>${titular}</strong></p>`,
          alias && `<p>Alias: <code>${alias}</code></p>`,
          cbu && `<p>CBU: <code>${cbu}</code></p>`]
          .filter(Boolean)
          .join("\n");

        await sendEmail({
          to: email,
          subject: `Tu pedido #${numero} está pendiente de pago`,
          html: `
            <p>Hola,</p>
            <p>Tu pedido <strong>#${numero}</strong> quedó registrado y está
            <strong>pendiente de pago</strong>.</p>
            <p>Para pagarlo, transferí el total exacto de
            <strong>$${total} ARS</strong> por transferencia bancaria a:</p>
            ${datosCuenta}
            <p><strong>Concepto: pedido #${numero}</strong> (poné el número de
            pedido en el concepto de la transferencia).</p>
            <p>Tenés ${PAYMENT_WINDOW_HOURS} horas para realizar la transferencia:
            pasado ese plazo el pedido se cancela automáticamente.</p>
            <p>Cuando recibamos la transferencia, te vamos a confirmar por
            email en las próximas horas.</p>
            <p>Gracias por tu compra.<br>IGUAZU MARKETPLACE</p>
          `,
          text:
            `Hola,\n\nTu pedido #${numero} quedó registrado y está pendiente de pago.\n\n` +
            `Para pagarlo, transferí el total exacto de $${total} ARS por transferencia bancaria a:\n` +
            `${banco ? `Banco: ${banco}\n` : ""}` +
            `Titular: ${titular}\n` +
            `${alias ? `Alias: ${alias}\n` : ""}` +
            `${cbu ? `CBU: ${cbu}\n` : ""}` +
            `\nConcepto: pedido #${numero} (poné el número de pedido en el concepto de la transferencia).\n\n` +
            `Tenés ${PAYMENT_WINDOW_HOURS} horas para realizar la transferencia: pasado ese plazo el pedido se cancela automáticamente.\n\n` +
            `Cuando recibamos la transferencia, te vamos a confirmar por email en las próximas horas.\n\n` +
            `Gracias por tu compra.\nIGUAZU MARKETPLACE\n`,
        });
      }
    } catch (error) {
      console.error("create-payment-transfer: error enviando email al cliente", error);
    }

    // ----------------------------------------------------------
    // 12. respuesta exitosa (pedido, pago y notificaciones hechos:
    //     no queda nada por liberar)
    //     alias / cbu / banco: se omiten del body si el secret
    //     correspondiente no está configurado (banco es opcional;
    //     alias y cbu requieren al menos uno presente, validado
    //     al principio).
    // ----------------------------------------------------------
    pendingRelease = null;
    return jsonResp({
      success: true,
      orderId,
      orderNumber: numeroPedido,
      amountArs: total,
      ...(alias ? { alias } : {}),
      ...(cbu ? { cbu } : {}),
      titular,
      ...(banco ? { banco } : {}),
      referencia: numero,
      paymentWindowHours: PAYMENT_WINDOW_HOURS,
    });
  } catch (error) {
    console.error("Error interno:", error);
    // Excepción no manejada después de crear la orden (pago,
    // notificaciones, respuesta): liberar reservas para no dejar
    // stock reservado sin proceso que lo sostenga. releaseOnce
    // evita duplicar si una rama de error explícita ya liberó.
    if (pendingRelease) {
      try {
        await releaseOnce();
      } catch (releaseError) {
        console.error(
          "create-payment-transfer: liberación de reservas falló en el catch externo",
          releaseError
        );
      }
    }
    return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
  }
});
