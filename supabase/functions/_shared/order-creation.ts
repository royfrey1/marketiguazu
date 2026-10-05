// ============================================================
// _shared/order-creation.ts — creación genérica de orden pending
// ============================================================
// Pasos 1-8 de create-payment, compartidos entre create-payment
// (Mercado Pago) y create-payment-usdt:
//
//   1. autenticación (JWT -> usuario)
//   2. validar payload (addressId, items, cantidades)
//   3. validar dirección (pertenece al usuario)
//   4. envío fijo: envio_costo = 0, total = subtotal,
//      metodo_envio = 'correo_argentino' (server-side)
//   5. validar productos, precios y stock
//   6. crear o reutilizar orden pending (y limpiar sus
//      order_items / pagos pendientes previos)
//   7. insertar order_items
//   8. reservar stock (con liberación de reservas si algo falla)
//
// NO crea el registro en "payments" ni ninguna preferencia de
// pago: eso queda en cada función que la use.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================================
// constantes
// ============================================================

// Envío fijo: único transportista y costo absorcido por el precio de producto.
export const SHIPMENT_METHOD = "correo_argentino";

// ============================================================
// tipos
// ============================================================

export interface CheckoutItem {
  productId: number;
  variantId: number | null;
  quantity: number;
}

export interface CreateOrderPayload {
  addressId: number;
  // Se ignora: el envío siempre queda 'correo_argentino' server-side.
  shippingMethodId?: string;
  items: CheckoutItem[];
}

export interface ValidatedItem {
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number;
  title: string;
  sku: string | null;
  variantName: string | null;
}

export interface ReservedItem {
  productId: number;
  variantId: number | null;
  quantity: number;
}

export type OrderErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_PAYLOAD"
  | "EMPTY_CART"
  | "INVALID_PRODUCT"
  | "INVALID_VARIANT"
  | "INVALID_QUANTITY"
  | "PRICE_CHANGED"
  | "ADDRESS_NOT_FOUND"
  | "STOCK_UNAVAILABLE"
  | "ORDER_CREATION_FAILED"
  | "PENDING_USDT_ORDER";

export interface OrderCreationFailure {
  success: false;
  code: OrderErrorCode;
  message: string;
  /** Status HTTP sugerido para la respuesta. */
  status: number;
  /** Solo en PENDING_USDT_ORDER: id de la orden existente que quedó intacta. */
  orderId?: number;
}

export interface OrderCreationSuccess {
  success: true;
  userId: string;
  orderId: number;
  numeroPedido: string | null;
  total: number;
  validatedItems: ValidatedItem[];
  reservedItems: ReservedItem[];
}

export type OrderCreationResult = OrderCreationSuccess | OrderCreationFailure;

function failure(code: OrderErrorCode, message: string, status = 400): OrderCreationFailure {
  return { success: false, code, message, status };
}

// ============================================================
// helper: liberar reservas (mismo patrón que usaba create-payment
// en cada rama de error posterior a la reserva)
// ============================================================

export async function releaseReservedItems(
  supabase: SupabaseClient,
  orderId: number,
  reservedItems: ReservedItem[],
): Promise<void> {
  for (const item of reservedItems) {
    const { error } = await supabase.rpc("release_reservation", {
      p_product_id: item.productId,
      p_variant_id: item.variantId,
      p_cantidad: item.quantity,
      p_order_id: orderId,
    });
    if (error) {
      console.error(
        `releaseReservedItems: release_reservation falló (order_id=${orderId}, product_id=${item.productId}, variant_id=${item.variantId}, cantidad=${item.quantity}): ${error.message}`,
      );
    }
  }
}

// ============================================================
// createPendingOrder
// ============================================================

export async function createPendingOrder(
  supabase: SupabaseClient,
  token: string,
  payload: CreateOrderPayload,
): Promise<OrderCreationResult> {
  // ----------------------------------------------------------
  // 1. autenticación (token explícito)
  // ----------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error("auth error:", authError?.message);
    return failure("AUTH_REQUIRED", "Usuario no autenticado", 401);
  }

  // ----------------------------------------------------------
  // 2. validar payload
  // ----------------------------------------------------------
  if (!payload || !payload.addressId || !Number.isInteger(payload.addressId)) {
    return failure("INVALID_PAYLOAD", "addressId inválido");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return failure("EMPTY_CART", "El carrito está vacío");
  }

  for (const item of payload.items) {
    if (!item.productId || !Number.isInteger(item.productId)) {
      return failure("INVALID_PAYLOAD", "productId inválido");
    }
    if (
      item.variantId !== null &&
      item.variantId !== undefined &&
      !Number.isInteger(item.variantId)
    ) {
      return failure("INVALID_PAYLOAD", "variantId inválido");
    }
    if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return failure("INVALID_QUANTITY", "Cantidad inválida");
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
    return failure(
      "ADDRESS_NOT_FOUND",
      "Dirección no encontrada o no pertenece al usuario"
    );
  }

  // ----------------------------------------------------------
  // 4. Envío fijo (sin cotización):
  //    envio_costo = 0, total = subtotal,
  //    metodo_envio = 'correo_argentino' (server-side).
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // 5. validar productos, precios y stock
  // ----------------------------------------------------------
  const validatedItems: ValidatedItem[] = [];

  for (const item of payload.items) {
    if (item.variantId != null) {
      const { data: variant, error: vErr } = await supabase
        .from("product_variants")
        .select("id, product_id, precio, nombre, sku, activo")
        .eq("id", item.variantId)
        .eq("product_id", item.productId)
        .single();

      if (vErr || !variant) {
        return failure("INVALID_VARIANT", `Variante ${item.variantId} no encontrada`);
      }
      if (!variant.activo) {
        return failure("INVALID_VARIANT", `Variante ${item.variantId} inactiva`);
      }

      const { data: product, error: pErr } = await supabase
        .from("products")
        .select("id, titulo, activo, precio")
        .eq("id", item.productId)
        .single();

      if (pErr || !product) {
        return failure("INVALID_PRODUCT", `Producto ${item.productId} no encontrado`);
      }
      if (!product.activo) {
        return failure("INVALID_PRODUCT", `Producto ${item.productId} inactivo`);
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
        return failure("INVALID_PRODUCT", `Producto ${item.productId} no encontrado`);
      }
      if (!product.activo) {
        return failure("INVALID_PRODUCT", `Producto ${item.productId} inactivo`);
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

  const total = validatedItems.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0
  );

  // ----------------------------------------------------------
  // 6. crear/reutilizar order pending
  // ----------------------------------------------------------
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, numero_pedido")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let orderId: number;
  let numeroPedido: string | null = null;

  if (existingOrder) {
    // ----------------------------------------------------------
    // Guarda: si la orden pending existente tiene un pago USDT
    // pendiente, NO se toca nada (los pedidos USDT quedan
    // esperando la verificación manual durante horas y el cliente
    // puede haber transferido ya): ni reservas, ni items, ni
    // pagos. Se responde con la orden existente para que el
    // frontend/cliente sepa cuál es.
    // ----------------------------------------------------------
    const { data: pendingUsdt } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", existingOrder.id)
      .eq("provider", "usdt")
      .eq("status", "pending")
      .maybeSingle();

    if (pendingUsdt) {
      return {
        success: false,
        code: "PENDING_USDT_ORDER",
        message: "Ya tenés un pedido pendiente de pago con USDT",
        status: 409,
        orderId: existingOrder.id,
      };
    }

    orderId = existingOrder.id;
    numeroPedido = existingOrder.numero_pedido;

    // Liberar reservas de los items anteriores antes de re-armar la orden
    // (release_reservation es idempotente). Si alguna liberación falla,
    // NO continuar: no borrar items ni reservar de menos sobre una
    // orden con reservas previas sin liberar.
    const { data: oldItems } = await supabase
      .from("order_items")
      .select("product_id, variant_id, cantidad")
      .eq("order_id", orderId);

    for (const old of oldItems ?? []) {
      const { error: releaseErr } = await supabase.rpc("release_reservation", {
        p_product_id: old.product_id,
        p_variant_id: old.variant_id,
        p_cantidad: old.cantidad,
        p_order_id: orderId,
      });
      if (releaseErr) {
        console.error(
          `createPendingOrder: release_reservation falló al re-armar la orden order_id=${orderId} (product_id=${old.product_id}, variant_id=${old.variant_id}): ${releaseErr.message}`,
        );
        return failure(
          "ORDER_CREATION_FAILED",
          "Error al liberar las reservas previas de la orden"
        );
      }
    }

    await supabase.from("order_items").delete().eq("order_id", orderId);

    await supabase
      .from("payments")
      .delete()
      .eq("order_id", orderId)
      .eq("status", "pending");

    await supabase
      .from("orders")
      .update({
        subtotal: total,
        total,
        envio_costo: 0,
        direccion_envio: address as unknown as Record<string, unknown>,
        metodo_envio: SHIPMENT_METHOD,
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  } else {
    const { data: newOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        subtotal: total,
        total,
        envio_costo: 0,
        direccion_envio: address as unknown as Record<string, unknown>,
        metodo_envio: SHIPMENT_METHOD,
        status: "pending",
        payment_status: "pending",
      })
      .select("id, numero_pedido")
      .single();

    if (orderErr || !newOrder) {
      return failure("ORDER_CREATION_FAILED", "Error al crear la orden", 500);
    }
    orderId = newOrder.id;
    numeroPedido = newOrder.numero_pedido;
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
    return failure("ORDER_CREATION_FAILED", "Error al crear items de la orden", 500);
  }

  // ----------------------------------------------------------
  // 8. reservar stock
  // ----------------------------------------------------------
  const reservedItems: ReservedItem[] = [];

  for (const item of validatedItems) {
    const { error: stockErr } = await supabase.rpc("reserve_stock", {
      p_product_id: item.productId,
      p_variant_id: item.variantId,
      p_cantidad: item.quantity,
      p_order_id: orderId,
    });

    if (stockErr) {
      // liberar reservas previas
      await releaseReservedItems(supabase, orderId, reservedItems);
      return failure("STOCK_UNAVAILABLE", `Stock insuficiente para ${item.title}`);
    }

    reservedItems.push({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    });
  }

  return {
    success: true,
    userId: user.id,
    orderId,
    numeroPedido,
    total,
    validatedItems,
    reservedItems,
  };
}
