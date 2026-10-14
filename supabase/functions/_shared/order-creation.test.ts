// ============================================================
// _shared/order-creation.test.ts — tests de createPendingOrder
// ============================================================
// Corre con:  node supabase/functions/_shared/order-creation.test.ts
// (Node >= 22.18 con type stripping; el import type de esm.sh
// se elimina en tiempo de transpilacion, sin red.)
//
// Cubre la regla de la opcion base opt-in:
//   item sin variante de producto con variantes activas exige
//   products.opcion_base_nombre IS NOT NULL.
//
// Son tests de LOGICA con un cliente supabase simulado:
// no tocan red ni base de datos.
// ============================================================

import {
  createPendingOrder,
  type CreateOrderPayload,
  type OrderCreationResult,
} from "./order-creation.ts";

// ------------------------------------------------------------
// tipos del mock
// ------------------------------------------------------------

interface ProductRow {
  id: number;
  titulo: string;
  activo: boolean;
  precio: number;
  opcion_base_nombre: string | null;
}

interface VariantRow {
  id: number;
  product_id: number;
  precio: number;
  nombre: string;
  sku: string | null;
  activo: boolean;
}

interface MockConfig {
  products: ProductRow[];
  variants: VariantRow[];
  reserveOk: boolean;
}

type SupaResult = Record<string, unknown>;

interface Op {
  k: "select" | "insert" | "update" | "delete" | "eq";
  cols?: string;
  opts?: { count?: string; head?: boolean };
  rows?: Record<string, unknown>[];
  patch?: Record<string, unknown>;
  col?: string;
  val?: unknown;
}

// ------------------------------------------------------------
// builder encadenable que resuelve por tabla
// ------------------------------------------------------------

class MockBuilder {
  private readonly table: string;
  private readonly cfg: MockConfig;
  private readonly writes: string[];
  private readonly ops: Op[] = [];

  constructor(table: string, cfg: MockConfig, writes: string[]) {
    this.table = table;
    this.cfg = cfg;
    this.writes = writes;
  }

  select(cols: string, opts?: { count?: string; head?: boolean }): this {
    this.ops.push({ k: "select", cols, opts });
    return this;
  }

  insert(rows: Record<string, unknown>[]): this {
    this.ops.push({ k: "insert", rows });
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.ops.push({ k: "update", patch });
    return this;
  }

  delete(): this {
    this.ops.push({ k: "delete" });
    return this;
  }

  eq(col: string, val: unknown): this {
    this.ops.push({ k: "eq", col, val });
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  single(): Promise<SupaResult> {
    const r = this.resolve();
    const data = r["data"];
    if (data === null || data === undefined) {
      return Promise.resolve({ data: null, error: { message: "no rows" } });
    }
    return Promise.resolve({ data, error: null });
  }

  maybeSingle(): Promise<SupaResult> {
    const r = this.resolve();
    return Promise.resolve({ data: r["data"] ?? null, error: null });
  }

  then<R>(
    onfulfilled?: ((value: SupaResult) => R | PromiseLike<R>) | null,
    onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null,
  ): Promise<R> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private eqs(): Map<string, unknown> {
    const m = new Map<string, unknown>();
    for (const op of this.ops) {
      if (op.k === "eq" && op.col !== undefined) m.set(op.col, op.val);
    }
    return m;
  }

  private resolve(): SupaResult {
    const first = this.ops[0];
    const eqs = this.eqs();

    if (this.table === "addresses") {
      return { data: { id: 7, user_id: "user-1", linea1: "Calle Falsa 123" }, error: null };
    }

    if (this.table === "products" && first.k === "select") {
      const id = eqs.get("id");
      const found = this.cfg.products.find((p) => p.id === id);
      return { data: found ?? null, error: found ? null : { message: "not found" } };
    }

    if (this.table === "product_variants") {
      if (first.opts?.head === true) {
        const pid = eqs.get("product_id");
        const activo = eqs.get("activo");
        const count = this.cfg.variants.filter(
          (v) => v.product_id === pid && v.activo === activo,
        ).length;
        return { data: null, count, error: null };
      }
      const id = eqs.get("id");
      const pid = eqs.get("product_id");
      const found = this.cfg.variants.find((v) => v.id === id && v.product_id === pid);
      return { data: found ?? null, error: found ? null : { message: "not found" } };
    }

    if (this.table === "orders") {
      if (first.k === "insert") {
        this.writes.push("orders.insert");
        return { data: { id: 42, numero_pedido: "PEDIDO-TEST-01" }, error: null };
      }
      if (first.k === "update") {
        this.writes.push("orders.update");
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }

    if (this.table === "order_items") {
      if (first.k === "insert") {
        this.writes.push("order_items.insert");
        return { data: null, error: null };
      }
      if (first.k === "delete") {
        this.writes.push("order_items.delete");
        return { data: null, error: null };
      }
      return { data: [], error: null };
    }

    if (this.table === "payments") {
      if (first.k === "delete") {
        this.writes.push("payments.delete");
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }

    return { data: null, error: { message: `tabla no soportada: ${this.table}` } };
  }
}

// ------------------------------------------------------------
// cliente supabase simulado
// ------------------------------------------------------------

function makeClient(cfg: MockConfig, writes: string[]) {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => new MockBuilder(table, cfg, writes),
    rpc: (name: string) => {
      writes.push(`rpc:${name}`);
      if (name === "reserve_stock" && !cfg.reserveOk) {
        return Promise.resolve({ data: null, error: { message: "stock insuficiente" } });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

// ------------------------------------------------------------
// utilidades
// ------------------------------------------------------------

function payload(items: { productId: number; variantId: number | null; quantity: number }[]): CreateOrderPayload {
  return { addressId: 7, items };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALLO: ${msg}`);
}

function codeOf(r: OrderCreationResult): string {
  return r.success ? "SUCCESS" : r.code;
}

async function run(
  name: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    return true;
  } catch (e) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(e as Error).message}`);
    return false;
  }
}

// ------------------------------------------------------------
// fixtures
// ------------------------------------------------------------

const SIMPLE_PRODUCT: ProductRow = {
  id: 100,
  titulo: "Producto Simple",
  activo: true,
  precio: 1000,
  opcion_base_nombre: null,
};

const VARIANTS_PRODUCT_NULL_OPTION: ProductRow = {
  id: 200,
  titulo: "Producto Con Variantes",
  activo: true,
  precio: 1500,
  opcion_base_nombre: null,
};

const VARIANTS_PRODUCT_BASE_OPTION: ProductRow = {
  id: 300,
  titulo: "Producto Con Variantes Y Base",
  activo: true,
  precio: 2000,
  opcion_base_nombre: "Talle",
};

const INACTIVE_VARIANTS_PRODUCT: ProductRow = {
  id: 400,
  titulo: "Solo Variantes Inactivas",
  activo: true,
  precio: 900,
  opcion_base_nombre: null,
};

const VARIANTS: VariantRow[] = [
  { id: 11, product_id: 200, precio: 1700, nombre: "Rojo", sku: null, activo: true },
  { id: 12, product_id: 300, precio: 2200, nombre: "Azul", sku: null, activo: true },
  { id: 13, product_id: 400, precio: 950, nombre: "Vieja", sku: null, activo: false },
];

// ------------------------------------------------------------
// casos
// ------------------------------------------------------------

async function caso1_producto_simple_ok(): Promise<void> {
  const writes: string[] = [];
  const client = makeClient(
    { products: [SIMPLE_PRODUCT], variants: [], reserveOk: true },
    writes,
  );
  const r = await createPendingOrder(client as never, "token-ok", payload([
    { productId: 100, variantId: null, quantity: 2 },
  ]));
  assert(r.success, `esperaba success, vino ${codeOf(r)}`);
  if (!r.success) return;
  assert(r.total === 2000, `total esperado 2000, vino ${r.total}`);
  assert(r.validatedItems[0].unitPrice === 1000, "unitPrice debe ser products.precio");
  assert(writes.includes("orders.insert"), "debio crear orden");
  assert(writes.includes("rpc:reserve_stock"), "debio reservar stock");
}

async function caso2_variantes_sin_opcion_rechaza(): Promise<void> {
  const writes: string[] = [];
  const client = makeClient(
    { products: [VARIANTS_PRODUCT_NULL_OPTION], variants: VARIANTS, reserveOk: true },
    writes,
  );
  const r = await createPendingOrder(client as never, "token-ok", payload([
    { productId: 200, variantId: null, quantity: 1 },
  ]));
  assert(!r.success, "esperaba rechazo");
  if (r.success) return;
  assert(r.code === "INVALID_VARIANT", `code esperado INVALID_VARIANT, vino ${r.code}`);
  assert(r.message === "Seleccioná una variante del producto", `mensaje inesperado: ${r.message}`);
  assert(writes.length === 0, `no debia escribir nada, escribio: ${writes.join(", ")}`);
}

async function caso3_variantes_con_opcion_base_ok(): Promise<void> {
  const writes: string[] = [];
  const client = makeClient(
    { products: [VARIANTS_PRODUCT_BASE_OPTION], variants: VARIANTS, reserveOk: true },
    writes,
  );
  const r = await createPendingOrder(client as never, "token-ok", payload([
    { productId: 300, variantId: null, quantity: 3 },
  ]));
  assert(r.success, `esperaba success, vino ${codeOf(r)}`);
  if (!r.success) return;
  assert(r.total === 6000, `total esperado 6000, vino ${r.total}`);
  assert(r.validatedItems[0].unitPrice === 2000, "unitPrice base debe ser products.precio");
  assert(r.validatedItems[0].variantId === null, "variantId debe ser null en opcion base");
  assert(r.validatedItems[0].title === "Producto Con Variantes Y Base", "title debe ser el titulo del producto");
}

async function caso4_item_con_variante_igual_que_antes(): Promise<void> {
  const writes: string[] = [];
  const client = makeClient(
    { products: [VARIANTS_PRODUCT_NULL_OPTION], variants: VARIANTS, reserveOk: true },
    writes,
  );
  const r = await createPendingOrder(client as never, "token-ok", payload([
    { productId: 200, variantId: 11, quantity: 2 },
  ]));
  assert(r.success, `esperaba success, vino ${codeOf(r)}`);
  if (!r.success) return;
  assert(r.total === 3400, `total esperado 3400, vino ${r.total}`);
  assert(r.validatedItems[0].unitPrice === 1700, "unitPrice debe ser precio de variante");
  assert(r.validatedItems[0].title === "Producto Con Variantes - Rojo", "title combinado de variante");
  assert(r.validatedItems[0].variantName === "Rojo", "variantName Rojo");
}

async function caso5_variantes_todas_inactivas_ok(): Promise<void> {
  const writes: string[] = [];
  const client = makeClient(
    { products: [INACTIVE_VARIANTS_PRODUCT], variants: VARIANTS, reserveOk: true },
    writes,
  );
  const r = await createPendingOrder(client as never, "token-ok", payload([
    { productId: 400, variantId: null, quantity: 1 },
  ]));
  assert(r.success, `esperaba success (sin variantes activas), vino ${codeOf(r)}`);
  if (!r.success) return;
  assert(r.total === 900, `total esperado 900, vino ${r.total}`);
  assert(r.validatedItems[0].unitPrice === 900, "unitPrice products.precio");
}

// ------------------------------------------------------------
// main
// ------------------------------------------------------------

async function main(): Promise<void> {
  console.log("order-creation.test.ts — opcion base opt-in");
  const results = await Promise.all([
    run("1. producto simple sin variantes compra OK", caso1_producto_simple_ok),
    run("2. variantes activas + opcion NULL rechaza item sin variante", caso2_variantes_sin_opcion_rechaza),
    run("3. variantes activas + opcion base seteada compra OK", caso3_variantes_con_opcion_base_ok),
    run("4. item con variante mantiene precio de variante", caso4_item_con_variante_igual_que_antes),
    run("5. variantes todas inactivas compra como producto simple", caso5_variantes_todas_inactivas_ok),
  ]);
  const ok = results.filter(Boolean).length;
  console.log(`resultado: ${ok}/${results.length}`);
  if (ok !== results.length) {
    throw new Error(`${results.length - ok} test(s) fallaron`);
  }
}

await main();
