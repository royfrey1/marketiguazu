import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================================
// mp-webhook — notificaciones de Mercado Pago (topic: payment)
//
// Flujo: validar firma HMAC (MP_WEBHOOK_SECRET) → GET al pago a la
// API de MP (estado real, nunca el body de la notificación) →
// mapear estado → RPC apply_mp_payment_status (service_role).
//
// Respuestas: 200 = procesado o no aplicable; 401 = firma inválida;
// 5xx = fallo transitorio → MP reintenta (15 min, 30 min, 6 h, …).
// La RPC es idempotente, repetir es seguro.
//
// verify_jwt = false (supabase/config.toml): MP no envía apikey ni
// JWT de Supabase; la autenticación real es la firma HMAC.
// ============================================================

const MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
const FETCH_TIMEOUT_MS = 8000;

// Estado crudo de MP → estado canónico de nuestro CHECK (5 valores).
// in_mediation con pago ya aprobado lo ignora la RPC (no degradar).
const MP_STATUS_MAP: Record<string, string> = {
  pending: "pending",
  in_process: "pending",
  authorized: "pending",
  in_mediation: "pending",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
  refunded: "refunded",
  charged_back: "refunded",
};

interface MpPayment {
  id: string | number;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number | null;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parseSignatureHeader(header: string): { ts: string; v1: string } | null {
  let ts = "";
  let v1 = "";
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  return ts && v1 ? { ts, v1 } : null;
}

// data.id alfanumérico se usa en minúsculas en el manifest (doc MP)
function normalizeDataId(dataId: string): string {
  return /^[0-9a-z]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
}

async function verifySignature(req: Request, dataId: string | null): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) return false;

  const xSignature = req.headers.get("x-signature");
  if (!xSignature) return false;
  const parts = parseSignatureHeader(xSignature);
  if (!parts) return false;

  // manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
  // (se omite el segmento si el valor no está presente)
  const segments: string[] = [];
  if (dataId) segments.push(`id:${normalizeDataId(dataId)}`);
  const requestId = req.headers.get("x-request-id");
  if (requestId) segments.push(`request-id:${requestId}`);
  segments.push(`ts:${parts.ts}`);
  const manifest = segments.join(";") + ";";

  const expected = await hmacSha256Hex(secret, manifest);
  return timingSafeEqualHex(expected, parts.v1);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResp({ received: false, error: "method not allowed" }, 405);
  }

  // fail-safe: sin secret no se procesa nada (nunca "*")
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) {
    console.error("MP_WEBHOOK_SECRET no configurado");
    return jsonResp({ received: false, error: "webhook secret not configured" }, 500);
  }

  const url = new URL(req.url);
  let body: { type?: string; data?: { id?: string } } = {};
  try {
    body = await req.json();
  } catch {
    // puede no traer body JSON: los datos vienen en la query
  }

  const dataId = url.searchParams.get("data.id") ?? body.data?.id ?? null;
  const type = url.searchParams.get("type") ?? body.type ?? null;

  // 1. firma HMAC
  if (!(await verifySignature(req, dataId))) {
    console.warn("mp-webhook: firma inválida", {
      dataId,
      requestId: req.headers.get("x-request-id"),
    });
    return jsonResp({ received: false, error: "invalid signature" }, 401);
  }

  // 2. solo el topic payment (Checkout Pro también manda merchant_order)
  if (type !== "payment") {
    console.log("mp-webhook: notificación ignorada", { type, dataId });
    return jsonResp({ received: true, skipped: type ?? "unknown topic" });
  }
  if (!dataId) {
    console.warn("mp-webhook: notificación sin data.id");
    return jsonResp({ received: true, skipped: "no data.id" });
  }

  // 3. estado real desde la API de MP (la notificación solo aporta el id)
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) {
    console.error("mp-webhook: MERCADOPAGO_ACCESS_TOKEN no configurado");
    return jsonResp({ received: false, error: "mp token not configured" }, 500);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let mpPayment: MpPayment;
  try {
    const mpRes = await fetch(`${MP_PAYMENTS_URL}/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (mpRes.status === 404) {
      console.warn("mp-webhook: pago MP no encontrado", { dataId });
      return jsonResp({ received: true, skipped: "payment not found" });
    }
    if (!mpRes.ok) {
      console.error("mp-webhook: GET payment MP falló", { status: mpRes.status, dataId });
      return jsonResp({ received: false, error: "mp fetch failed" }, 502);
    }
    mpPayment = await mpRes.json();
  } catch (err) {
    console.error("mp-webhook: error consultando MP", err);
    return jsonResp({ received: false, error: "mp fetch error" }, 500);
  } finally {
    clearTimeout(timer);
  }

  // 4. mapear estado crudo → canónico
  const rawStatus = String(mpPayment.status);
  const mappedStatus = MP_STATUS_MAP[rawStatus];
  if (!mappedStatus) {
    console.warn("mp-webhook: status MP desconocido", { rawStatus });
    return jsonResp({ received: true, skipped: `unknown status: ${rawStatus}` });
  }

  // 5. aplicar en BD (RPC idempotente, solo service_role)
  const { data: result, error: rpcError } = await supabase.rpc(
    "apply_mp_payment_status",
    {
      p_provider_payment_id: String(mpPayment.id),
      p_external_reference:
        mpPayment.external_reference != null
          ? String(mpPayment.external_reference)
          : null,
      p_new_status: mappedStatus,
      p_raw_status: rawStatus,
      p_mp_amount:
        typeof mpPayment.transaction_amount === "number"
          ? mpPayment.transaction_amount
          : null,
    },
  );

  if (rpcError) {
    console.error("mp-webhook: RPC falló", rpcError.message);
    return jsonResp({ received: false, error: "rpc failed" }, 500);
  }

  const outcome = result as { reason?: string } | null;
  if (outcome?.reason === "amount_mismatch" || outcome?.reason === "order_cancelled_late_payment") {
    console.error("mp-webhook: requiere atención manual", JSON.stringify(result));
  } else {
    console.log("mp-webhook: procesado", JSON.stringify(result));
  }

  return jsonResp({ received: true, result });
});
