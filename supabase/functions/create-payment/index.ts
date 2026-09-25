// ============================================================
// F7 T2.2 — Edge Function: create-payment
// ============================================================
// Crea o reutiliza una order pending, reserva stock, genera
// una Preferencia de Mercado Pago y devuelve init_point.
//
// NO implementa webhook ni confirmación de pago.
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================================
// constantes
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MP_API_URL = "https://api.mercadopago.com/checkout/preferences";

// ============================================================
// tipos
// ============================================================

interface CheckoutItem {
  productId: number;
  variantId: number | null;
  quantity: number;
}

interface CreatePaymentPayload {
  addressId: number;
  shippingMethodId: string;
  items: CheckoutItem[];
}

type ErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_PAYLOAD"
  | "EMPTY_CART"
  | "INVALID_PRODUCT"
  | "INVALID_VARIANT"
  | "INVALID_QUANTITY"
  | "PRICE_CHANGED"
  | "ADDRESS_NOT_FOUND"
  | "SHIPPING_METHOD_REQUIRED"
  | "SHIPPING_QUOTE_REQUIRED"
  | "STOCK_UNAVAILABLE"
  | "ORDER_CREATION_FAILED"
  | "PAYMENT_CREATION_FAILED"
  | "MERCADOPAGO_ERROR"
  | "INTERNAL_ERROR";

interface FunctionError {
  code: ErrorCode;
  message: string;
}

// ============================================================
// helpers
// ============================================================

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function errResp(code: ErrorCode, message: string, status = 400): Response {
  return jsonResp({ success: false, error: { code, message } }, status);
}

// ============================================================
// handler principal
// ============================================================

serve(async (req: Request): Promise<Response> => {
  // preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errResp("INVALID_PAYLOAD", "Método no permitido", 405);
  }

  try {
    // ----------------------------------------------------------
    // 1. autenticación
    // ----------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errResp("AUTH_REQUIRED", "Token de autenticación requerido", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const siteUrl = Deno.env.get("SITE_URL") || "https://marketplace-iguazu.vercel.app";

    if (!mpAccessToken) {
      return errResp(
        "INTERNAL_ERROR",
        "Variable de entorno MERCADOPAGO_ACCESS_TOKEN no configurada",
        500
      );
    }

    // cliente con service role (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // verificar JWT y obtener usuario
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errResp("AUTH_REQUIRED", "Usuario no autenticado", 401);
    }

    // ----------------------------------------------------------
    // 2. validar payload
    // ----------------------------------------------------------
    let payload: CreatePaymentPayload;
    try {
      payload = await req.json();
    } catch {
      return errResp("INVALID_PAYLOAD", "Body de request inválido");
    }

    if (!payload.addressId || !Number.isInteger(payload.addressId)) {
      return errResp("INVALID_PAYLOAD", "addressId inválido");
    }
    if (
      !payload.shippingMethodId ||
      typeof payload.shippingMethodId !== "string"
    ) {
      return errResp("SHIPPING_METHOD_REQUIRED", "Método de envío requerido");
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return errResp("EMPTY_CART", "El carrito está vacío");
    }

    for (const item of payload.items) {
      if (!item.productId || !Number.isInteger(item.productId)) {
        return errResp("INVALID_PAYLOAD", "productId inválido");
      }
      if (
        item.variantId !== null &&
        item.variantId !== undefined &&
        !Number.isInteger(item.variantId)
      ) {
        return errResp("INVALID_PAYLOAD", "variantId inválido");
      }
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return errResp("INVALID_QUANTITY", "Cantidad inválida");
      }
    }

    // ----------------------------------------------------------
    // 3. validar dirección
    // ----------------------------------------------------------
    const { data: address, error: addrError } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", payload.addressId)
      .eq("user_id", user.id)
      .single();

    if (addrError || !address) {
      return errResp(
        "ADDRESS_NOT_FOUND",
        "Dirección no encontrada o no pertenece al usuario"
      );
    }

    // ----------------------------------------------------------
    // 4. SHIPPING_QUOTE_REQUIRED
    //     No hay cotización real de envío todavía.
    //     Rechazar para no crear orden inconsistente.
    // ----------------------------------------------------------
    return errResp(
      "SHIPPING_QUOTE_REQUIRED",
      "No se puede generar el pago sin una cotización de envío válida. La integración de cotización está pendiente.",
      422
    );

    // ----------------------------------------------------------
    // NOTA: el código debajo de esta línea NO se ejecuta
    // mientras SHIPPING_QUOTE_REQUIRED esté activo.
    // Se mantiene completo para cuando se implemente la
    // cotización de envío en una tarea futura.
    // ----------------------------------------------------------

    /*
    // ----------------------------------------------------------
    // 5. validar productos, precios y stock
    // ----------------------------------------------------------
    const validatedItems: Array<{
      productId: number;
      variantId: number | null;
      quantity: number;
      unitPrice: number;
      title: string;
      sku: string | null;
      variantName: string | null;
    }> = [];

    for (const item of payload.items) {
      if (item.variantId != null) {
        const { data: variant, error: vErr } = await supabase
          .from("product_variants")
          .select("id, product_id, precio, nombre, sku, activo")
          .eq("id", item.variantId)
          .eq("product_id", item.productId)
          .single();

        if (vErr || !variant) {
          return errResp("INVALID_VARIANT", `Variante ${item.variantId} no encontrada`);
        }
        if (!variant.activo) {
          return errResp("INVALID_VARIANT", `Variante ${item.variantId} inactiva`);
        }

        const { data: product, error: pErr } = await supabase
          .from("products")
          .select("id, titulo, activo, precio")
          .eq("id", item.productId)
          .single();

        if (pErr || !product) {
          return errResp("INVALID_PRODUCT", `Producto ${item.productId} no encontrado`);
        }
        if (!product.activo) {
          return errResp("INVALID_PRODUCT", `Producto ${item.productId} inactivo`);
        }

        validatedItems.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: variant.precio,
          title: `${product.titulo} - ${variant.nombre}`,
          sku: variant.sku,
          variantName: variant.nombre,
        });
      } else {
        const { data: product, error: pErr } = await supabase
          .from("products")
          .select("id, titulo, activo, precio")
          .eq("id", item.productId)
          .single();

        if (pErr || !product) {
          return errResp("INVALID_PRODUCT", `Producto ${item.productId} no encontrado`);
        }
        if (!product.activo) {
          return errResp("INVALID_PRODUCT", `Producto ${item.productId} inactivo`);
        }

        validatedItems.push({
          productId: item.productId,
          variantId: null,
          quantity: item.quantity,
          unitPrice: product.precio,
          title: product.titulo,
          sku: null,
          variantName: null,
        });
      }
    }

    // ----------------------------------------------------------
    // 6. crear/reutilizar order pending
    // ----------------------------------------------------------
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let orderId: number;

    if (existingOrder) {
      orderId = existingOrder.id;

      await supabase.from("order_items").delete().eq("order_id", orderId);

      await supabase
        .from("payments")
        .delete()
        .eq("order_id", orderId)
        .eq("status", "pending");

      const subtotal = validatedItems.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0
      );

      await supabase
        .from("orders")
        .update({
          subtotal,
          total: subtotal,
          envio_costo: 0,
          direccion_envio: address as unknown as Record<string, unknown>,
          metodo_envio: payload.shippingMethodId,
          payment_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
    } else {
      const subtotal = validatedItems.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0
      );

      const { data: newOrder, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal,
          total: subtotal,
          envio_costo: 0,
          direccion_envio: address as unknown as Record<string, unknown>,
          metodo_envio: payload.shippingMethodId,
          status: "pending",
          payment_status: "pending",
        })
        .select("id")
        .single();

      if (orderErr || !newOrder) {
        return errResp(
          "ORDER_CREATION_FAILED",
          "Error al crear la orden",
          500
        );
      }
      orderId = newOrder.id;
    }

    // ----------------------------------------------------------
    // 7. insertar order_items
    // ----------------------------------------------------------
    const orderItems = validatedItems.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      variant_id: item.variantId,
      nombre_producto: item.title,
      variante_nombre: item.variantName,
      sku: item.sku,
      precio_unitario: item.unitPrice,
      cantidad: item.quantity,
      subtotal: item.unitPrice * item.quantity,
    }));

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsErr) {
      return errResp(
        "ORDER_CREATION_FAILED",
        "Error al crear items de la orden",
        500
      );
    }

    // ----------------------------------------------------------
    // 8. reservar stock
    // ----------------------------------------------------------
    const reservedItems: Array<{
      productId: number;
      variantId: number | null;
      quantity: number;
    }> = [];

    for (const item of validatedItems) {
      const { error: stockErr } = await supabase.rpc("reserve_stock", {
        p_product_id: item.productId,
        p_variant_id: item.variantId,
        p_cantidad: item.quantity,
        p_order_id: orderId,
      });

      if (stockErr) {
        // liberar reservas previas
        for (const prev of reservedItems) {
          await supabase.rpc("release_reservation", {
            p_product_id: prev.productId,
            p_variant_id: prev.variantId,
            p_cantidad: prev.quantity,
            p_order_id: orderId,
          });
        }
        return errResp(
          "STOCK_UNAVAILABLE",
          `Stock insuficiente para ${item.title}`
        );
      }

      reservedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    // ----------------------------------------------------------
    // 9. crear payment pendiente
    // ----------------------------------------------------------
    const total = validatedItems.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0
    );

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
        for (const prev of reservedItems) {
          await supabase.rpc("release_reservation", {
            p_product_id: prev.productId,
            p_variant_id: prev.variantId,
            p_cantidad: prev.quantity,
            p_order_id: orderId,
          });
        }
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
    });

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text();

      for (const prev of reservedItems) {
        await supabase.rpc("release_reservation", {
          p_product_id: prev.productId,
          p_variant_id: prev.variantId,
          p_cantidad: prev.quantity,
          p_order_id: orderId,
        });
      }

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
    // 11. respuesta exitosa
    // ----------------------------------------------------------
    return jsonResp({
      success: true,
      orderId,
      orderNumber: null,
      initPoint: preference.init_point,
    });
    */
  } catch (error) {
    console.error("Error interno:", error);
    return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
  }
});
