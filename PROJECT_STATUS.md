# Iguazú Marketplace — Estado del Proyecto

**Última actualización:** 2026-10-05
**Fuente:** QA manual del usuario + auditoría de opencode con verificación en vivo (repo, BD remota y Supabase CLI) el 2026-10-05

> Este documento es la fuente de verdad de en qué fase estamos. Actualizarlo después de cada sesión de trabajo relevante (no hace falta después de cada micro-tarea).

---

## 🎯 Momento actual

Estamos en la **recta final previa al lanzamiento**: QA de producción y requisitos legales/dominio. La tienda opera end-to-end en producción (checkout con Mercado Pago, webhook, páginas de resultado con pedido real), con pago alternativo en USDT (TRC20) probado de punta a punta, **modelo de stock corregido** (reservas por saldo neto, `confirm_sale` al aprobar), variantes de producto con galería propia, sidebar de subcategorías y teléfono de contacto obligatorio. Todo el trabajo está commiteado y pusheado (working tree limpio al cierre de esta sesión). El trabajo que queda no es de construcción: es legal, dominio/emails y limpieza de datos de QA.

### ✅ Hechos confirmados por QA manual

- **2026-09-26** — Checkout con Mercado Pago end-to-end funcionando en producción: webhook `mp-webhook` con validación de firma (`5988d64`), ajustes de preferencia/notificación (`4e659ce`, `a4a8039`) y páginas de resultado que leen el pedido real; botón de verificación manual de pago MP en el admin (`a1c8196`, 2026-09-29).
- **2026-10-02** — Bug del carrito corregido en `8fc4a5c`: ya no se vacía antes de pagar; el carrito y la sesión persisten al cancelar el pago.
- **2026-10-05** — Variantes de producto con galería propia por variante, dropdown de variantes y orden de imágenes por drag & drop en el admin (`b8dc73a`); las 4 migraciones del bloque están aplicadas en remoto.
- **2026-10-05** — Sidebar de subcategorías con filtro por subárbol (`a39767a`).
- **2026-10-05** — Pago con USDT (TRC20) como alternativa a Mercado Pago: selector MP/USDT en el checkout, cotización en vivo (CriptoYa), verificación **manual** por el admin ("Confirmar pago recibido"), aviso push por ntfy al admin al crear el pedido, email al cliente (Resend), página `/pago/usdt`, guard contra pisar un pedido USDT pendiente (409 `PENDING_USDT_ORDER`) y plazo de 24 h (el cron cancela a las 25 h). Probado de punta a punta en local: pedido, push, mail, segundo checkout con pedido pendiente, confirmación y cancelación (`6f52bc6`).
  - **Estado final del stock (tras los arreglos del mismo día):** `cancel_order` libera la reserva por **saldo neto** al cancelar, y al aprobar un pago USDT el backend llama a `confirm_sale` (igual que con Mercado Pago: baja `quantity` y `reserved`). Cancelar un pedido con pago aprobado (MP o USDT) **NO repone `quantity`**: el admin la repone a mano en Inventario (decisión del usuario; automatizar más adelante). El admin muestra el aviso en el modal de cancelación y un banner posterior con los productos a revisar.
- **2026-10-05** — Teléfono de contacto obligatorio en direcciones (normalizado a `+549XXXXXXXXXX`), el checkout bloquea direcciones sin teléfono y botón "Escribir por WhatsApp" en el detalle de pedido del admin (`2a5fbb7`).
- **2026-10-05** — Franja animada de medios de pago en la Home y bloque de precio en la ficha de producto: precio por transferencia, cuotas MP con recargo y línea de USDT (`fbd7cff`).
- **2026-10-05** — Bug de loading infinito de `useCatalog` resuelto (hoy tiene `try/catch/finally` en `src/hooks/useProducts.ts`).
- **2026-10-05** — Bug de reserva de stock: `cancel_order` no liberaba la reserva cuando la orden pending se había reutilizado (re-armo: release + nueva reserva) antes de cancelarse, dejando `inventory.reserved` clavado; corregido con **idempotencia por saldo neto** (delegando en `release_reservation`). 3 inventarios huérfanos (41, 55 y 71) corregidos con `release_reservation` (`739706e`).
- **2026-10-05** — Guard de pagos: no se puede aprobar ni modificar el pago de un pedido cancelado (`update_payment_status` lanza excepción); `cancel_order` pasa a `cancelled` los pagos `pending` (nunca toca los `approved`); el admin oculta "Confirmar/Verificar pago" en pedidos cancelados y muestra avisos de stock/reembolso al cancelar con pago aprobado (`4f63f32`).
- **2026-10-05** — `confirm_sale` al aprobar pagos manuales no-MP (USDT): al aprobar, la reserva se convierte en venta; si no hay reserva vigente, la aprobación falla sin aprobar nada. Endurecimiento de `create-payment-usdt`/`order-creation` ante fallos: timeouts en CriptoYa (6 s) y en la preferencia MP (10 s), liberación de reservas ante excepciones en el catch externo y verificación de errores de `release_reservation` (`a039a94`, `6fe9152`).
- **Commits recientes (todos pusheados):** `8fc4a5c`, `b8dc73a`, `6f52bc6`, `a39767a`, `d1ba6cc`, `2a5fbb7`, `fbd7cff`, `739706e`, `4f63f32`, `a039a94`, `6fe9152`.

---

## 🚨 Bloqueadores críticos (antes del lanzamiento, resolver en este orden)

1. **Textos legales**: Términos y Condiciones (con apartado de pago USDT), Política de Privacidad, botón de arrepentimiento, checkbox de aceptación en el checkout, datos del proveedor (razón social/CUIT/domicilio).
2. **Dominio propio**: verificarlo en Resend (hoy los emails a clientes reales fallan con 403; solo llegan al email dueño de la cuenta de Resend), cambiar el secret `RESEND_FROM_EMAIL`, reemplazar el email placeholder `contacto@iguazumarketplace.com` (Footer y ReportPage).
3. **Rotar `MP_WEBHOOK_SECRET`**.
4. **Productos de QA 1007/1008 visibles en producción**: ocultarlos o borrarlos.
5. **Primer pago USDT real**: confirmar en Binance que el depósito entró ANTES de apretar "Confirmar pago recibido" (la wallet nunca se probó con un depósito).

---

## 📋 Roadmap — estado por fase

| Fase | Estado | Nota |
|---|---|---|
| 0 — Auditoría | ✅ Completa | |
| 1 — Fundación técnica | ✅ Completa | TS strict, layouts, design tokens, rutas protegidas |
| 2 — Base de datos | ✅ Completa | 16 tablas + specs completas; **RLS verificado en vivo el 2026-10-05**: `carts`, `cart_items`, `favorites`, `addresses`, `products`, `categories` y `price_history` con RLS activo y policies (migración `sync_rls_state_with_remote` aplicada en remoto) |
| 3 — Auth/usuarios | ✅ Completa | |
| 4 — Catálogo | ✅ Completa | Home, búsqueda, PDP, variantes con galería propia por variante, favoritos |
| 5 — Carrito | ✅ Completa | Invitado + sincronización con login; persiste al cancelar el pago |
| 6 — Checkout | ✅ Completa | Mercado Pago end-to-end en producción; teléfono obligatorio; selector MP/USDT |
| 7 — Mercado Pago | ✅ Completa | `create-payment`, `mp-webhook` y `admin-verify-payment` desplegadas (ACTIVE) y probadas |
| 8 — Pedidos | ✅ Completa | Pedidos reales, páginas de resultado con estado real, confirmación manual de pago USDT desde el admin |
| 9 — Envíos | 🔶 Parcial | Proveedores manuales + cotizador Correo Argentino; `create-quote` existe en el repo pero **no está desplegada** y hoy nada la invoca desde el frontend (ver Deuda técnica) |
| 10 — Admin | 🔶 Parcial | Falta módulo **Clientes** (sin verificar) |
| 11 — Seguridad/QA | 🔶 Parcial | RLS cerrado y verificado en vivo; QA manual de los flujos principales hecho; queda el checklist de casos extremos (stock 0, pago duplicado, compras simultáneas) (sin verificar) |
| 12 — SEO/Performance | 🔶 Parcial | Verificado 2026-10-05: sigue `lang="en"` en `index.html`, sin meta description/OG, sin `robots.txt` ni `sitemap.xml` |
| 13 — Lanzamiento | ⬜ No iniciada | Dependiente de los bloqueadores de arriba |

**Edge Functions desplegadas (verificadas el 2026-10-05):** `create-payment` (v27), `mp-webhook` (v19), `admin-verify-payment` (v10), `create-payment-usdt` (v11), `send-order-email` (v10) — todas ACTIVE. `create-quote` solo existe en el repo (no desplegada).

---

## 🧹 Deuda técnica y pendientes

### Antes del lanzamiento (bloqueantes)

La lista completa vive en **🚨 Bloqueadores críticos** (única fuente de verdad de esta sección; no duplicarla acá).

### No bloqueantes

- ntfy: usar un topic con sufijo aleatorio largo (hoy es adivinable), igual en la app y en el secret `NTFY_TOPIC`.
- Validar el teléfono de la dirección en el **backend** (hoy la validación es solo de frontend; las Edge Functions no lo exigen).
- En Mi cuenta, el botón "+ Nueva" no limpia el formulario si antes se canceló una edición.
- Precargar el teléfono de la dirección desde `profiles`.
- `npx tsc -b` tiene 52 errores preexistentes (verificado 2026-10-05; el build de Vite compila bien); lint en 67 problemas (58 errores, 9 warnings) como línea base.
- `sort_order=0` cosmético en galerías; la galería se comparte entre variantes de distinta capacidad.
- Chunk de build >500 kB, sin script `typecheck`, sin tests, `tailwind.config.js` duplicado.
- Variable `VITE_WHATSAPP_URL`: cargada como Config en Vercel (Production y Preview) (sin verificar).
- SEO pendiente (Fase 12): `lang="en"` en `index.html`, sin meta description/OG, sin `robots.txt` ni `sitemap.xml`.
- Hardcodeos vigentes (verificado 2026-10-05): `'DEMO-SKU-001'` como fallback de SKU en `ProductPage.tsx` y link a portfolio personal en `Footer.tsx`.
- `create-quote`: **no se usa actualmente desde el frontend** — solo la referencia `src/services/shipping.service.ts`, cuya función `fetchShippingQuote` no es llamada por ningún componente; decidir si se despliega o se elimina.
- Fixtures QA (productos 1007/1008): el inventario 31 (producto 1008) tiene movimientos de fixtures del 16/09 y un ajuste manual sin referencia, así que muestra una discrepancia contra el libro de movimientos; se resuelve al borrar/ocultar los productos QA antes del lanzamiento.
- Automatizar la reposición de stock al cancelar pedidos con pago aprobado (hoy es manual, con aviso en el admin).

---

## ✅ Próximos pasos (orden recomendado)

1. **Textos legales + checkbox de aceptación en el checkout** — único requisito legal que falta
2. **Dominio propio → verificación en Resend → nuevo `RESEND_FROM_EMAIL` → quitar el email placeholder** (Footer y ReportPage)
3. **Rotar `MP_WEBHOOK_SECRET`**
4. **Limpiar productos de QA 1007/1008** de la producción
5. **Primer pago USDT real**, verificando el depósito en Binance antes de confirmar en el admin
6. **QA de casos extremos** (Fase 11): stock 0, pago duplicado, compras simultáneas — ahora con el modelo de stock ya corregido
7. **SEO básico + limpieza de Tailwind config** (Fase 12)
8. **Checklist de lanzamiento** (Fase 13)

---

## 🗂️ Historial de sesiones

- **2026-10-05** — Cierre del bloque de QA post-pago: bug del carrito corregido antes de pagar (`8fc4a5c`), variantes de producto con galería propia por variante, dropdown y drag & drop de imágenes con 4 migraciones aplicadas en remoto (`b8dc73a`), backend y frontend del pago USDT con guard 409, ntfy, emails y página `/pago/usdt` (`6f52bc6`), sidebar de subcategorías (`a39767a`), teléfono obligatorio con WhatsApp en el detalle de pedido (`2a5fbb7`) y franja de medios de pago en Home y ficha (`fbd7cff`). Todo commiteado y pusheado; verificación en vivo de RLS, cron de expiración y Edge Functions desplegadas en la BD remota; bug de `useCatalog` confirmado resuelto.
- **2026-10-05** — Cierre del bloque de stock: `cancel_order` con idempotencia por saldo neto y 3 inventarios huérfanos corregidos (`739706e`); guard de pedidos cancelados en pagos + avisos de stock/reembolso en el admin (`4f63f32`); `confirm_sale` al aprobar pagos manuales USDT (`a039a94`); endurecimiento de `create-payment-usdt` y `order-creation` ante fallos, timeouts y errores de release (`6fe9152`). Migraciones aplicadas en remoto; funciones redeployadas (`create-payment` v27, `create-payment-usdt` v11).
- **2026-09-25** — Auditoría inicial completa vía opencode. Diagnóstico: falta conectar pago end-to-end. Enviado prompt de estabilización (commits, bug useCatalog, RLS, .env.example, README).
