// ============================================================
// _shared/mp-payment — lógica compartida de Mercado Pago
//
// Usado por mp-webhook (notificaciones automáticas) y
// admin-verify-payment (verificación manual del admin).
// Un solo lugar para: fetch del pago, mapeo de estado y la RPC
// apply_mp_payment_status (sin duplicar ninguna de las dos).
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export const MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
export const FETCH_TIMEOUT_MS = 8000;

// Estado crudo de MP → estado canónico de nuestro CHECK (5 valores).
// in_mediation con pago ya aprobado lo ignora la RPC (no degradar).
export const MP_STATUS_MAP: Record<string, string> = {
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

export interface MpPayment {
  id: string | number;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number | null;
}

export type MpFetchResult =
  | { ok: true; payment: MpPayment }
  | { ok: false; notFound: boolean; status?: number; error?: string };

async function mpGet(url: string, accessToken: string): Promise<MpFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (res.status === 404) {
      return { ok: false, notFound: true, status: 404 };
    }
    if (!res.ok) {
      return { ok: false, notFound: false, status: res.status, error: `mp http ${res.status}` };
    }
    return { ok: true, payment: await res.json() };
  } catch (err) {
    return {
      ok: false,
      notFound: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function fetchMpPaymentById(
  accessToken: string,
  paymentId: string,
): Promise<MpFetchResult> {
  return mpGet(`${MP_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`, accessToken);
}

export type MpSearchResult =
  | { ok: true; payment: MpPayment | null }
  | { ok: false; status?: number; error?: string };

// Búsqueda por external_reference (orders.id): para cuando todavía no
// guardamos provider_payment_id. MP devuelve resultados más recientes
// primero; nos quedamos con el primero.
export async function fetchMpPaymentByExternalReference(
  accessToken: string,
  externalReference: string,
): Promise<MpSearchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${MP_PAYMENTS_URL}/search?external_reference=${encodeURIComponent(externalReference)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      return { ok: false, status: res.status, error: `mp http ${res.status}` };
    }
    const body = await res.json() as { results?: MpPayment[] };
    const results = Array.isArray(body.results) ? body.results : [];
    return { ok: true, payment: results[0] ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export function mapMpStatus(rawStatus: string): string | null {
  return MP_STATUS_MAP[rawStatus] ?? null;
}

export interface ApplyMpResult {
  changed: boolean;
  reason?: string;
  payment_status?: string;
  order_status?: string;
  [key: string]: unknown;
}

// Misma llamada a la RPC idempotente (solo service_role) que usa el
// webhook. El caller decide qué responder según result/error.
export async function applyMpPaymentStatus(
  supabase: SupabaseClient,
  mpPayment: MpPayment,
  mappedStatus: string,
): Promise<{ result: ApplyMpResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc("apply_mp_payment_status", {
    p_provider_payment_id: String(mpPayment.id),
    p_external_reference:
      mpPayment.external_reference != null
        ? String(mpPayment.external_reference)
        : null,
    p_new_status: mappedStatus,
    p_raw_status: String(mpPayment.status),
    p_mp_amount:
      typeof mpPayment.transaction_amount === "number"
        ? mpPayment.transaction_amount
        : null,
  });
  if (error) return { result: null, error: error.message };
  return { result: (data ?? null) as ApplyMpResult | null, error: null };
}
