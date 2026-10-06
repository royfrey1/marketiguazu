# Iguazú Marketplace — Estado del Proyecto

**Última actualización:** 2026-10-06
**Fuente:** QA manual del usuario + auditoría de opencode con verificación en vivo (repo, BD remota y Supabase CLI) el 2026-10-06

> Este documento es la fuente de verdad de en qué fase estamos. Actualizarlo después de cada sesión de trabajo relevante (no hace falta después de cada micro-tarea).

---

## 🎯 Momento actual

Estamos en la **recta final previa al lanzamiento**: QA de producción, requisitos legales/dominio y limpieza de datos de QA. La tienda opera end-to-end en producción (checkout con Mercado Pago, webhook, páginas de resultado con pedido real), con pago alternativo en USDT (TRC20) probado de punta a punta, **modelo de stock corregido** (reservas por saldo neto, `confirm_sale` al aprobar), variantes de producto con galería propia, sidebar de subcategorías y teléfono de contacto obligatorio. Desde 2026-10-06 los **textos legales están publicados** (con aceptación en checkout y registro) y el **botón de arrepentimiento está completo** (página pública con constancia, estado en el pedido y gestión en el admin). Todo el trabajo de la sesión está commiteado (working tree limpio; el push cierra la sesión). El trabajo que queda no es de construcción: es completar datos del titular, dominio/emails, rotar secretos y limpiar datos de QA.

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
- **2026-10-06** — Textos legales publicados: Términos y Condiciones, Política de Privacidad y Cambios y devoluciones en `/terminos`, `/privacidad` y `/devoluciones`, con checkbox de aceptación en checkout y registro (`c5ddfc4`).
- **2026-10-06** — Botón de arrepentimiento completo: backend (`f16ace3`) con tabla `withdrawal_requests`, Edge Function `request-withdrawal` v1 y RPC `admin_update_withdrawal`; frontend (`04be7bb`) con página pública `/arrepentimiento` (con y sin sesión) que emite constancia, bloque de constancia/estado en el pedido del cliente, pantalla `/admin/arrepentimientos` con contador en el menú lateral y banner en el detalle de pedido del admin. Footer y ReportPage leen el contacto único de `src/config/legal.ts` (`LEGAL.EMAIL_CONTACTO`).
- **2026-10-06** — Arreglos de diseño del admin: tablas de pedidos y de arrepentimientos con `overflow-x-auto` y breakpoint `xl`, fila de arrepentimientos clickeable y accesible por teclado (`925f9b6`); `.gitignore` ampliado a `.env*` con excepción de `.env.example` (`00b9ab7`).
- **2026-10-06** — Seguridad: se detectó que unas migraciones de QA versionadas documentan la contraseña de usuarios de prueba. La cuenta de QA con rol admin fue **neutralizada** (rol bajado a cliente, contraseña aleatoria descartada, cuenta bloqueada) y se auditaron el repo y su historial completo: sin claves ni tokens expuestos. Queda anotado: **no ejecutar esas migraciones QA en bases nuevas**; la cuenta de QA con rol customer y los datos de prueba se eliminan al final del QA.
- **Commits recientes (todos pusheado al cerrar esta sesión):** `8fc4a5c`, `b8dc73a`, `6f52bc6`, `a39767a`, `d1ba6cc`, `2a5fbb7`, `fbd7cff`, `739706e`, `4f63f32`, `a039a94`, `6fe9152`, `c5ddfc4`, `f16ace3`, `04be7bb`, `925f9b6`, `00b9ab7`.

---

## 🚨 Bloqueadores críticos (antes del lanzamiento, resolver en este orden)

1. **Datos del titular en `src/config/legal.ts`**: razón social, CUIT, domicilio, condición fiscal, plazo de entrega, analíticas y fecha de publicación (los textos legales ya están publicados; solo faltan estos datos).
2. **Dominio propio**: verificarlo en Resend (hoy los emails a clientes reales fallan con 403; solo llegan al email dueño de la cuenta de Resend), cambiar el secret `RESEND_FROM_EMAIL`, y agregar ese remitente a los orígenes CORS de `request-withdrawal` o definir el secret `SITE_URL`.
3. **Rotar el topic de ntfy**: aleatorio y largo, con el mismo valor en la app y en el secret `NTFY_TOPIC`.
4. **Rotar `MP_WEBHOOK_SECRET`**.
5. **Cuenta de QA con rol customer y datos de prueba**: borrar o banear la cuenta (queda activa hasta que termine el QA en producción), limpiar productos 1007/1008, pedidos y pagos fixture, y reponer a mano el stock afectado por los pedidos de prueba.
6. **Primer pago USDT real**: confirmar en Binance que el depósito entró ANTES de apretar "Confirmar pago recibido" (la wallet nunca se probó con un depósito).

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
| 6 — Checkout | ✅ Completa | Mercado Pago end-to-end en producción; teléfono obligatorio; selector MP/USDT; aceptación de términos |
| 7 — Mercado Pago | ✅ Completa | `create-payment`, `mp-webhook` y `admin-verify-payment` desplegadas (ACTIVE) y probadas |
| 8 — Pedidos | ✅ Completa | Pedidos reales, páginas de resultado con estado real, confirmación manual de pago USDT desde el admin; arrepentimiento con constancia y gestión en admin |
| 9 — Envíos | 🔶 Parcial | Proveedores manuales + cotizador Correo Argentino; `create-quote` existe en el repo pero **no está desplegada** y hoy nada la invoca desde el frontend (ver Deuda técnica) |
| 10 — Admin | 🔶 Parcial | Falta módulo **Clientes** (sin verificar) |
| 11 — Seguridad/QA | 🔶 Parcial | RLS cerrado y verificado en vivo; QA manual de los flujos principales hecho; seguridad del repo auditada (2026-10-06); queda el checklist de casos extremos (stock 0, pago duplicado, compras simultáneas) (sin verificar) |
| 12 — SEO/Performance | 🔶 Parcial | Verificado 2026-10-05: sigue `lang="en"` en `index.html`, sin meta description/OG, sin `robots.txt` ni `sitemap.xml` |
| 13 — Lanzamiento | ⬜ No iniciada | Dependiente de los bloqueadores de arriba |

**Edge Functions desplegadas** (las 5 primeras verificadas el 2026-10-05; `request-withdrawal` desplegada y verificada el 2026-10-06): `create-payment` (v27), `mp-webhook` (v19), `admin-verify-payment` (v10), `create-payment-usdt` (v11), `send-order-email` (v10), `request-withdrawal` (v1) — todas ACTIVE. `create-quote` solo existe en el repo (no desplegada).

---

## 🧹 Deuda técnica y pendientes

### Antes del lanzamiento (bloqueantes)

La lista completa vive en **🚨 Bloqueadores críticos** (única fuente de verdad de esta sección; no duplicarla acá).

### No bloqueantes

- Persistir la aceptación de términos (guardar fecha y versión aceptada; hoy el checkbox no deja registro).
- El login siempre vuelve a `/`, no al formulario de arrepentimiento desde el que se inició sesión.
- La lista de arrepentimientos del admin está limitada a 200 filas, sin paginación.
- `src/lib/supabase/types.ts` tiene los tipos de `withdrawal_requests` escritos a mano; regenerarlos con la CLI de Supabase debería dar lo mismo.
- Validar el teléfono de la dirección en el **backend** (hoy la validación es solo de frontend; las Edge Functions no lo exigen).
- En Mi cuenta, el botón "+ Nueva" no limpia el formulario si antes se canceló una edición.
- Precargar el teléfono de la dirección desde `profiles`.
- `npx tsc -b` tiene 52 errores preexistentes (verificado 2026-10-06; el build de Vite compila bien); lint en 67 problemas (58 errores, 9 warnings) como línea base.
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

1. **Completar datos del titular en `src/config/legal.ts`** (razón social, CUIT, domicilio, condición fiscal, plazo de entrega, analíticas, fecha de publicación)
2. **Dominio propio → verificación en Resend → nuevo `RESEND_FROM_EMAIL` → CORS de `request-withdrawal` o secret `SITE_URL`**
3. **Rotar el topic de ntfy** (mismo valor en la app y en `NTFY_TOPIC`)
4. **Rotar `MP_WEBHOOK_SECRET`**
5. **Limpiar la cuenta de QA con rol customer y los datos de prueba** (productos 1007/1008, pedidos/pagos fixture; reponer stock a mano)
6. **Primer pago USDT real**, verificando el depósito en Binance antes de confirmar en el admin
7. **QA de casos extremos** (Fase 11): stock 0, pago duplicado, compras simultáneas — ahora con el modelo de stock ya corregido
8. **SEO básico + limpieza de Tailwind config** (Fase 12)
9. **Checklist de lanzamiento** (Fase 13)

---

## 🗂️ Historial de sesiones

- **2026-10-06** — Cierre del bloque legal y del arrepentimiento: textos legales publicados con aceptación en checkout y registro (`c5ddfc4`), backend del arrepentimiento con tabla, Edge Function y RPC (`f16ace3`), frontend con página `/arrepentimiento`, constancia, estado en pedidos y pantalla de gestión con contador en el menú (`04be7bb`), arreglos de diseño de las tablas del admin (`925f9b6`) y `.gitignore` ampliado a `.env*` (`00b9ab7`). Verificaciones contra la línea base (build Vite, `tsc -b` en 52, lint en 67) y revisión de secretos sobre todo el diff antes del push. En seguridad: neutralización de la cuenta de QA con rol admin (rol bajado, contraseña aleatoria y bloqueo), auditoría del repo y de su historial sin claves ni tokens expuestos, y constancias de prueba de arrepentimiento borradas con la secuencia reiniciada para que la próxima constancia sea `ARR-000001`.
- **2026-10-05** — Cierre del bloque de QA post-pago: bug del carrito corregido antes de pagar (`8fc4a5c`), variantes de producto con galería propia por variante, dropdown y drag & drop de imágenes con 4 migraciones aplicadas en remoto (`b8dc73a`), backend y frontend del pago USDT con guard 409, ntfy, emails y página `/pago/usdt` (`6f52bc6`), sidebar de subcategorías (`a39767a`), teléfono obligatorio con WhatsApp en el detalle de pedido (`2a5fbb7`) y franja de medios de pago en Home y ficha (`fbd7cff`). Todo commiteado y pusheado; verificación en vivo de RLS, cron de expiración y Edge Functions desplegadas en la BD remota; bug de `useCatalog` confirmado resuelto.
- **2026-10-05** — Cierre del bloque de stock: `cancel_order` con idempotencia por saldo neto y 3 inventarios huérfanos corregidos (`739706e`); guard de pedidos cancelados en pagos + avisos de stock/reembolso en el admin (`4f63f32`); `confirm_sale` al aprobar pagos manuales USDT (`a039a94`); endurecimiento de `create-payment-usdt` y `order-creation` ante fallos, timeouts y errores de release (`6fe9152`). Migraciones aplicadas en remoto; funciones redeployadas (`create-payment` v27, `create-payment-usdt` v11).
- **2026-09-25** — Auditoría inicial completa vía opencode. Diagnóstico: falta conectar pago end-to-end. Enviado prompt de estabilización (commits, bug useCatalog, RLS, .env.example, README).
