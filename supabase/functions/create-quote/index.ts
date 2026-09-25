// ============================================================
// F7 T2.2.3 — Edge Function: create-quote
// ============================================================
// Obtiene una cotización real de envío contra la API MiCorreo
// de Correo Argentino.
//
// NO crea órdenes, pagos, shipments ni modifica stock.
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

const VALID_SHIPPING_METHODS = ["correo_argentino"] as const;

const CA_ENV = Deno.env.get("CORREO_ARGENTINO_ENV") || "production";
const CA_BASE_URL =
  CA_ENV === "test"
    ? "https://apitest.correoargentino.com.ar/micorreo/v1"
    : "https://api.correoargentino.com.ar/micorreo/v1";

// ============================================================
// tipos
// ============================================================

interface QuoteItem {
  productId: number;
  variantId: number | null;
  quantity: number;
}

interface QuotePayload {
  addressId: number;
  shippingMethodId: string;
  items: QuoteItem[];
}

type ErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_PAYLOAD"
  | "INVALID_SHIPPING_METHOD"
  | "ADDRESS_NOT_FOUND"
  | "INVALID_POSTAL_CODE"
  | "ORIGIN_POSTAL_CODE_NOT_CONFIGURED"
  | "CORREO_ARGENTINO_NOT_CONFIGURED"
  | "CORREO_ARGENTINO_AUTH_ERROR"
  | "PRODUCT_NOT_FOUND"
  | "VARIANT_NOT_FOUND"
  | "VARIANT_PRODUCT_MISMATCH"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_SHIPPING_DATA_MISSING"
  | "PACKAGE_DATA_INVALID"
  | "CORREO_ARGENTINO_QUOTE_ERROR"
  | "CORREO_ARGENTINO_TIMEOUT"
  | "QUOTE_RESPONSE_INVALID"
  | "NO_RATE_AVAILABLE"
  | "NO_HOME_DELIVERY_RATE"
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
// Autenticación contra Correo Argentino
// ============================================================

async function getCaToken(): Promise<string> {
  const user = Deno.env.get("CORREO_ARGENTINO_USER");
  const password = Deno.env.get("CORREO_ARGENTINO_PASSWORD");

  if (!user || !password) {
    throw new Error("CORREO_ARGENTINO_NOT_CONFIGURED");
  }

  const credentials = btoa(`${user}:${password}`);

  const resp = await fetch(`${CA_BASE_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    console.error("CA token error:", resp.status);
    throw new Error("CORREO_ARGENTINO_AUTH_ERROR");
  }

  const data = await resp.json();
  return data.token;
}

// ============================================================
// Obtener customerId
// ============================================================

async function getCustomerId(token: string): Promise<string> {
  const user = Deno.env.get("CORREO_ARGENTINO_USER");
  const password = Deno.env.get("CORREO_ARGENTINO_PASSWORD");

  if (!user || !password) {
    throw new Error("CORREO_ARGENTINO_NOT_CONFIGURED");
  }

  const resp = await fetch(`${CA_BASE_URL}/users/validate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: user, password }),
  });

  if (!resp.ok) {
    console.error("CA users/validate error:", resp.status);
    throw new Error("CORREO_ARGENTINO_AUTH_ERROR");
  }

  const data = await resp.json();
  return data.customerId;
}

// ============================================================
// Construcción del paquete (PARTE 11)
// ============================================================
// Estrategia para MVP: SUMAR pesos, EMPAQUETAR en un solo
// contenedor calculando dimensions que contenga todos los
// productos apilados.
//
// Para cantidades > 1 de un mismo producto, se suma el peso
// y se multiplica el espacio ocupado por la cantidad.
//
// Limitación conocida: no conocemos la forma física real de
// cada producto. Este cálculo es una aproximación conservadora
// que puede sobreestimar dimensiones.
// ============================================================

interface PackageDimensions {
  weight: number; // gramos
  height: number; // cm
  width: number;  // cm
  length: number; // cm
}

interface ProductLogistics {
  product_id: number;
  peso_envio_gramos: number | null;
  alto_paquete_cm: number | null;
  ancho_paquete_cm: number | null;
  largo_paquete_cm: number | null;
}

function buildPackage(
  products: Array<{ quantity: number; logistics: ProductLogistics }>
): PackageDimensions {
  let totalWeight = 0;

  // Acumular volumen total y dimensiones máximas
  let maxHeight = 0;
  let maxWidth = 0;
  let totalLength = 0;

  for (const item of products) {
    const l = item.logistics;
    const qty = item.quantity;

    totalWeight += l.peso_envio_gramos * qty;

    // Estrategia: los productos se apilan en largo.
    // Alto y ancho se determinan por el producto más grande.
    maxHeight = Math.max(maxHeight, l.alto_paquete_cm);
    maxWidth = Math.max(maxWidth, l.ancho_paquete_cm);
    totalLength += l.largo_paquete_cm * qty;
  }

  return {
    weight: totalWeight,
    height: maxHeight,
    width: maxWidth,
    length: totalLength,
  };
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
    // 1. autenticación de usuario
    // ----------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errResp("AUTH_REQUIRED", "Token de autenticación requerido", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

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
    let payload: QuotePayload;
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
      !VALID_SHIPPING_METHODS.includes(
        payload.shippingMethodId as (typeof VALID_SHIPPING_METHODS)[number]
      )
    ) {
      return errResp(
        "INVALID_SHIPPING_METHOD",
        `Método de envío inválido. Solo está habilitado: ${VALID_SHIPPING_METHODS.join(", ")}`
      );
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return errResp("INVALID_PAYLOAD", "El carrito está vacío");
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
      if (
        !item.quantity ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return errResp("INVALID_PAYLOAD", "quantity inválido");
      }
    }

    // ----------------------------------------------------------
    // 3. validar dirección del usuario
    // ----------------------------------------------------------
    const { data: address, error: addrError } = await supabase
      .from("addresses")
      .select("codigo_postal, ciudad, provincia")
      .eq("id", payload.addressId)
      .eq("user_id", user.id)
      .single();

    if (addrError || !address) {
      return errResp(
        "ADDRESS_NOT_FOUND",
        "Dirección no encontrada o no pertenece al usuario"
      );
    }

    if (
      !address.codigo_postal ||
      typeof address.codigo_postal !== "string" ||
      address.codigo_postal.trim().length < 4
    ) {
      return errResp(
        "INVALID_POSTAL_CODE",
        "La dirección no tiene un código postal válido"
      );
    }

    const postalCodeDestination = address.codigo_postal.trim();

    // ----------------------------------------------------------
    // 4. código postal de origen
    // ----------------------------------------------------------
    const postalCodeOrigin = Deno.env.get(
      "CORREO_ARGENTINO_POSTAL_CODE_ORIGIN"
    );
    if (!postalCodeOrigin) {
      return errResp(
        "ORIGIN_POSTAL_CODE_NOT_CONFIGURED",
        "Código postal de origen no configurado"
      );
    }

    // ----------------------------------------------------------
    // 5. credenciales de Correo Argentino
    // ----------------------------------------------------------
    const caUser = Deno.env.get("CORREO_ARGENTINO_USER");
    const caPassword = Deno.env.get("CORREO_ARGENTINO_PASSWORD");
    if (!caUser || !caPassword) {
      return errResp(
        "CORREO_ARGENTINO_NOT_CONFIGURED",
        "Credenciales de Correo Argentino no configuradas"
      );
    }

    // ----------------------------------------------------------
    // 6. obtener productos y validar datos logísticos
    // ----------------------------------------------------------
    const productIds = payload.items.map((i) => i.productId);

    const { data: products, error: prodError } = await supabase
      .from("products")
      .select(
        "id, activo, peso_envio_gramos, alto_paquete_cm, ancho_paquete_cm, largo_paquete_cm"
      )
      .in("id", productIds);

    if (prodError) {
      console.error("Error fetching products:", prodError);
      return errResp("INTERNAL_ERROR", "Error al obtener productos", 500);
    }

    const productMap = new Map((products || []).map((p) => [p.id, p]));

    // validar cada item
    for (const item of payload.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return errResp(
          "PRODUCT_NOT_FOUND",
          `Producto ${item.productId} no encontrado`
        );
      }
      if (!product.activo) {
        return errResp(
          "PRODUCT_INACTIVE",
          `Producto ${item.productId} inactivo`
        );
      }
      if (
        product.peso_envio_gramos == null ||
        product.alto_paquete_cm == null ||
        product.ancho_paquete_cm == null ||
        product.largo_paquete_cm == null
      ) {
        return errResp(
          "PRODUCT_SHIPPING_DATA_MISSING",
          `Producto ${item.productId} no tiene datos logísticos de envío`
        );
      }
    }

    // validar variantes si se especifican
    const variantItems = payload.items.filter(
      (i) => i.variantId != null
    );
    if (variantItems.length > 0) {
      const variantIds = variantItems.map((i) => i.variantId!);
      const { data: variants, error: varError } = await supabase
        .from("product_variants")
        .select("id, product_id, activo")
        .in("id", variantIds);

      if (varError) {
        console.error("Error fetching variants:", varError);
        return errResp("INTERNAL_ERROR", "Error al obtener variantes", 500);
      }

      const variantMap = new Map((variants || []).map((v) => [v.id, v]));

      for (const item of variantItems) {
        const variant = variantMap.get(item.variantId!);
        if (!variant) {
          return errResp(
            "VARIANT_NOT_FOUND",
            `Variante ${item.variantId} no encontrada`
          );
        }
        if (variant.product_id !== item.productId) {
          return errResp(
            "VARIANT_PRODUCT_MISMATCH",
            `Variante ${item.variantId} no pertenece al producto ${item.productId}`
          );
        }
        if (!variant.activo) {
          return errResp(
            "PRODUCT_INACTIVE",
            `Variante ${item.variantId} inactiva`
          );
        }
      }
    }

    // ----------------------------------------------------------
    // 7. construir paquete
    // ----------------------------------------------------------
    const packageData = payload.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        quantity: item.quantity,
        logistics: {
          product_id: product.id,
          peso_envio_gramos: product.peso_envio_gramos!,
          alto_paquete_cm: product.alto_paquete_cm!,
          ancho_paquete_cm: product.ancho_paquete_cm!,
          largo_paquete_cm: product.largo_paquete_cm!,
        },
      };
    });

    const pkg = buildPackage(packageData);

    // validar límites antes de enviar a CA
    if (pkg.weight < 1 || pkg.weight > 25000) {
      return errResp(
        "PACKAGE_DATA_INVALID",
        `Peso total del paquete inválido: ${pkg.weight}g (máximo 25000g)`
      );
    }
    if (pkg.height < 1 || pkg.height > 150) {
      return errResp(
        "PACKAGE_DATA_INVALID",
        `Alto del paquete inválido: ${pkg.height}cm (máximo 150cm)`
      );
    }
    if (pkg.width < 1 || pkg.width > 150) {
      return errResp(
        "PACKAGE_DATA_INVALID",
        `Ancho del paquete inválido: ${pkg.width}cm (máximo 150cm)`
      );
    }
    if (pkg.length < 1 || pkg.length > 150) {
      return errResp(
        "PACKAGE_DATA_INVALID",
        `Largo del paquete inválido: ${pkg.length}cm (máximo 150cm)`
      );
    }

    // ----------------------------------------------------------
    // 8. autenticación contra Correo Argentino
    // ----------------------------------------------------------
    let caToken: string;
    let customerId: string;

    try {
      caToken = await getCaToken();
      customerId = await getCustomerId(caToken);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "CORREO_ARGENTINO_NOT_CONFIGURED") {
        return errResp(
          "CORREO_ARGENTINO_NOT_CONFIGURED",
          "Credenciales de Correo Argentino no configuradas"
        );
      }
      if (msg === "CORREO_ARGENTINO_AUTH_ERROR") {
        return errResp(
          "CORREO_ARGENTINO_AUTH_ERROR",
          "Error al autenticar con Correo Argentino"
        );
      }
      return errResp("INTERNAL_ERROR", "Error interno", 500);
    }

    // ----------------------------------------------------------
    // 9. llamar a /rates
    // ----------------------------------------------------------
    const ratesPayload = {
      customerId,
      postalCodeOrigin,
      postalCodeDestination,
      deliveredType: "D",
      dimensions: {
        weight: pkg.weight,
        height: pkg.height,
        width: pkg.width,
        length: pkg.length,
      },
    };

    let ratesResponse: Response;
    try {
      ratesResponse = await fetch(`${CA_BASE_URL}/rates`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${caToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ratesPayload),
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        return errResp(
          "CORREO_ARGENTINO_TIMEOUT",
          "Tiempo de espera agotado al consultar Correo Argentino"
        );
      }
      console.error("CA /rates network error:", e);
      return errResp(
        "CORREO_ARGENTINO_QUOTE_ERROR",
        "Error de red al consultar Correo Argentino"
      );
    }

    if (!ratesResponse.ok) {
      const errorBody = await ratesResponse.text();
      console.error("CA /rates error:", ratesResponse.status, errorBody);
      return errResp(
        "CORREO_ARGENTINO_QUOTE_ERROR",
        `Error de Correo Argentino (${ratesResponse.status})`
      );
    }

    const ratesData = await ratesResponse.json();

    // ----------------------------------------------------------
    // 10. mapear respuesta según contrato oficial
    // ----------------------------------------------------------
    // Contrato confirmado (apiMiCorreo.pdf):
    // {
    //   customerId: string,
    //   validTo: string,
    //   rates: [{
    //     deliveredType: "D" | "S",
    //     productType: string,
    //     productName: string,
    //     price: number
    //   }]
    // }
    // ----------------------------------------------------------

    // validar estructura raíz
    if (!ratesData || typeof ratesData !== "object" || Array.isArray(ratesData)) {
      console.error("CA /rates: respuesta no es un objeto:", typeof ratesData);
      return errResp("QUOTE_RESPONSE_INVALID", "Respuesta inválida de Correo Argentino");
    }

    if (!Array.isArray(ratesData.rates)) {
      console.error("CA /rates: campo 'rates' no es array:", typeof ratesData.rates);
      return errResp("QUOTE_RESPONSE_INVALID", "Respuesta inválida de Correo Argentino");
    }

    if (ratesData.rates.length === 0) {
      return errResp("NO_RATE_AVAILABLE", "Correo Argentino no devolvió cotizaciones");
    }

    // validar validTo
    if (!ratesData.validTo || typeof ratesData.validTo !== "string") {
      return errResp("QUOTE_RESPONSE_INVALID", "Fecha de vigencia inválida");
    }
    const validToParsed = Date.parse(ratesData.validTo);
    if (Number.isNaN(validToParsed)) {
      return errResp("QUOTE_RESPONSE_INVALID", "Fecha de vigencia inválida");
    }

    // filtrar solo rates a domicilio (deliveredType = "D")
    const homeRates = ratesData.rates.filter(
      (r: Record<string, unknown>) => r.deliveredType === "D"
    );

    if (homeRates.length === 0) {
      return errResp(
        "NO_HOME_DELIVERY_RATE",
        "No hay opciones de entrega a domicilio disponibles"
      );
    }

    // validar y seleccionar el primer rate D
    const selectedRate = homeRates[0];

    if (
      typeof selectedRate.price !== "number" ||
      !Number.isFinite(selectedRate.price) ||
      selectedRate.price < 0
    ) {
      console.error("CA /rates: price inválido:", selectedRate.price);
      return errResp("QUOTE_RESPONSE_INVALID", "Precio inválido en la cotización");
    }

    if (
      selectedRate.deliveredType !== "D" &&
      selectedRate.deliveredType !== "S"
    ) {
      return errResp("QUOTE_RESPONSE_INVALID", "Tipo de entrega inválido");
    }

    if (
      typeof selectedRate.productType !== "string" ||
      typeof selectedRate.productName !== "string"
    ) {
      return errResp("QUOTE_RESPONSE_INVALID", "Datos del servicio inválidos");
    }

    // ----------------------------------------------------------
    // 11. respuesta exitosa
    // ----------------------------------------------------------
    return jsonResp({
      success: true,
      provider: "correo_argentino",
      shippingCost: selectedRate.price,
      currency: "ARS",
      serviceType: selectedRate.productType,
      serviceName: selectedRate.productName,
      deliveredType: selectedRate.deliveredType,
      validTo: ratesData.validTo,
    });
  } catch (error) {
    console.error("Error interno:", error);
    return errResp("INTERNAL_ERROR", "Error interno del servidor", 500);
  }
});
