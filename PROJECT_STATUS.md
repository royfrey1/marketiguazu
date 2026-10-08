# Iguazú Marketplace — Estado del Proyecto

**Última actualización:** 2026-10-07
**Fuente:** QA manual del usuario + auditoría de opencode con verificación en vivo (repo, BD remota y Supabase CLI) el 2026-10-07

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
- **2026-10-07** — Fix del registro (`ccaa8c3`): en desktop el panel blanco de `/register` hace scroll interno y el formulario es más compacto, de modo que el botón y el link de login quedan alcanzables incluso con un error visible; mobile sin cambios.
- **2026-10-07** — Topic de ntfy **rotado**: el valor nuevo quedó con el mismo valor en la app y en el secret `NTFY_TOPIC` (el valor no se documenta acá ni en ningún lado).
- **2026-10-07** — Botón flotante de WhatsApp verificado funcionando en producción (confirmación del dueño); la dirección de la wallet USDT también fue confirmada por el dueño como correcta.
- **2026-10-07** — **Pago por transferencia bancaria (backend):** Edge Function `create-payment-transfer` desplegada con `verify_jwt` activo (el gateway corta las llamadas sin Authorization con 401); provider `transfer` **sin migración** (el CHECK de `payments.provider` solo exige longitud); precio de contado (el total es el precio publicado, sin recargo); ventana de 24 h (la cancela el cron existente); aviso push al admin y email al cliente; secrets `TRANSFER_*` cargados como secrets de Edge Functions (solo nombres, no valores). `_shared/order-creation.ts` bloquea un nuevo checkout si la orden pending tiene un pago manual pendiente (409 `PENDING_USDT_ORDER` / `PENDING_TRANSFER_ORDER` con el `orderId`) y el guard vale para los 3 métodos. QA de la función: 401 de gateway sin sesión, checkout 200 con payment `transfer`/`pending` y metadata correcta, segundo checkout 409, usdt y Mercado Pago también 409, stock restaurado exacto al final.
- **2026-10-07** — **Frontend de transferencia y tanda informativa:** tercer método "Transferencia bancaria" en el checkout con página `/pago/transferencia`, etiqueta de transferencia en Mis pedidos y en el admin; Términos 1.6.3 y ajustes en 1.4/1.6/1.7/1.8 y devoluciones 3.2/3.5; páginas informativas nuevas Nosotros, Preguntas frecuentes, Envíos, Medios de pago y Contacto; TopBar mobile; envío gratis a todo el país en todos los productos; plazo de entrega de 6 a 7 días hábiles.
- **2026-10-07** — **QA manual de punta a punta del pago por transferencia en producción (hecho por el dueño):** creación del pedido, reserva de stock, confirmación manual desde el admin y baja de stock; sin errores funcionales detectados en el flujo. Queda anotado como pendiente, a resolver por el dueño, la limpieza de los datos de ese QA manual (pedidos de prueba y ajuste de stock).
- **2026-10-07** — **Ajustes visuales del checkout y de las páginas de pago:** selector de medios de pago en fila de 3 desde 1280 px (xl); `/pago/transferencia` solo permite copiar el alias y el CBU (titular y banco son texto fijo); `/pago/transferencia` y `/pago/usdt` en 2 columnas desde 1024 px (lg).
- **Commits recientes (todos pusheado al cerrar esta sesión):** `8fc4a5c`, `b8dc73a`, `6f52bc6`, `a39767a`, `d1ba6cc`, `2a5fbb7`, `fbd7cff`, `739706e`, `4f63f32`, `a039a94`, `6fe9152`, `c5ddfc4`, `f16ace3`, `04be7bb`, `925f9b6`, `00b9ab7`, `ccaa8c3`.

---

## 🚨 Bloqueadores críticos (antes del lanzamiento, resolver en este orden)

1. **Datos del titular en `src/config/legal.ts`**: razón social, CUIT, domicilio, condición fiscal, plazo de entrega, analíticas y fecha de publicación (los textos legales ya están publicados; solo faltan estos datos).
2. **Dominio propio**: verificarlo en Resend (hoy los emails a clientes reales fallan con 403; solo llegan al email dueño de la cuenta de Resend), cambiar el secret `RESEND_FROM_EMAIL`, y agregar ese remitente a los orígenes CORS de `request-withdrawal` o definir el secret `SITE_URL`.
3. **Rotar `MP_WEBHOOK_SECRET`**.
4. **Cuenta de QA con rol customer y datos de prueba**: borrar o banear la cuenta (queda activa hasta que termine el QA en producción), limpiar productos 1007/1008, pedidos y pagos fixture, y reponer a mano el stock afectado por los pedidos de prueba.
5. **Primer pago USDT real**: confirmar en Binance que el depósito entró ANTES de apretar "Confirmar pago recibido" (la dirección de la wallet fue confirmada por el dueño como correcta, pero nunca se probó con un depósito real).

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

**Edge Functions desplegadas** (verificadas con `supabase functions list` el 2026-10-07): `create-payment` (v33), `mp-webhook` (v24), `admin-verify-payment` (v15), `create-payment-usdt` (v17), `create-payment-transfer` (v1), `send-order-email` (v15), `request-withdrawal` (v6) — todas ACTIVE. `create-quote` solo existe en el repo (no desplegada).

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
- SEO pendiente (Fase 12): `lang="en"` en `index.html`, sin meta description/OG, sin `robots.txt` ni `sitemap.xml`.
- Hardcodeos vigentes (verificado 2026-10-05): `'DEMO-SKU-001'` como fallback de SKU en `ProductPage.tsx` y link a portfolio personal en `Footer.tsx`.
- `create-quote`: **no se usa actualmente desde el frontend** — solo la referencia `src/services/shipping.service.ts`, cuya función `fetchShippingQuote` no es llamada por ningún componente; decidir si se despliega o se elimina.
- Fixtures QA (productos 1007/1008): el inventario 31 (producto 1008) tiene movimientos de fixtures del 16/09 y un ajuste manual sin referencia, así que muestra una discrepancia contra el libro de movimientos; se resuelve al borrar/ocultar los productos QA antes del lanzamiento.
- ~~QA de punta a punta de la transferencia con la cuenta QA **después** del deploy del frontend~~ — **hecho** (ver "Hechos confirmados por QA manual", 2026-10-07, transferencia punta a punta en producción).
- Limpieza de los datos del QA manual de transferencia (pedidos de prueba y ajuste de stock): a resolver por el dueño.
- Warning de React preexistente en `src/pages/checkout/CheckoutStepEnvio.tsx:165` (`onComplete` llamado durante el render).
- `index.html` sigue con `lang="en"`: resolver en la tarea de SEO (Fase 12).
- `PaymentOrderSummary` tiene `max-w-md` fijo, anulado desde el wrapper.
- Desborde estético de ~10 px de una palabra en el selector de medios de pago a 1024 px.
- Mejora futura: botón "Cancelar este pedido" en las páginas de pago para que el cliente libere un pedido manual pendiente (hoy un cliente con un pago manual pendiente no puede iniciar otra compra hasta que se pague o se cancele, hasta 25 h).
- El admin muestra los montos redondeados a pesos (sin decimales).
- `src/pages/checkout/CheckoutContext.tsx:75`: el comentario dice "ambos métodos" y ya son tres.
- `PaymentUsdtPage` promete confirmar el pago por WhatsApp o email; la confirmación real llega por email (o a mano desde el admin).
- Automatizar la reposición de stock al cancelar pedidos con pago aprobado (hoy es manual, con aviso en el admin).

---

## ✅ Próximos pasos (orden recomendado)

1. **Cards de producto unificadas** con imagen cuadrada entera (en curso)
2. **Rediseño del menú mobile** (drawer) (en curso)
3. **Página de Contacto** y textos del footer que no son links
4. **SEO básico** (Fase 12): `lang="es"`, meta description/OG, `robots.txt` y `sitemap.xml`
5. **Bloqueantes de lanzamiento**: datos legales en `src/config/legal.ts`, rotar `MP_WEBHOOK_SECRET`, limpiar datos de QA (productos 1007/1008, pedidos/pagos fixture, banear o borrar al cliente QA), primer pago USDT real, dominio propio + Resend + `RESEND_FROM_EMAIL` + CORS de `request-withdrawal` (o `SITE_URL`)

---

## 🗂️ Historial de sesiones

- **2026-10-07 (noche)** — Commit de los ajustes visuales del checkout y de las páginas de pago: selector de medios de pago en fila de 3 desde xl, `/pago/transferencia` copiando solo alias y CBU (titular y banco como texto fijo), `/pago/transferencia` y `/pago/usdt` en 2 columnas desde lg; `PROJECT_STATUS.md` actualizado con el QA de punta a punta de transferencia del dueño (hecho; su limpieza de datos queda como pendiente) y deuda técnica nueva (warning de React en `CheckoutStepEnvio`, `max-w-md` de `PaymentOrderSummary`, desborde del selector a 1024 px, `lang="en"` para la tarea de SEO, botón de cancelación en páginas de pago y la limpieza del QA). Verificado contra la línea base (`tsc -b` 52, lint 67, build OK, escaneo de secretos sin matches).
- **2026-10-07 (tarde)** — Tanda de transferencia + frontend: `create-payment-transfer` desplegada (v1) y `create-payment`/`create-payment-usdt` redeployadas con el guard `PENDING_TRANSFER_ORDER` (v33/v17); QA completo de la función con la cuenta QA (401 gateway, 200 con payment `transfer`, 409 en los tres métodos, stock restaurado exacto y datos de prueba sin huérfanos); reconciliación de versiones (el código desplegado coincidía 100% con el repo). Frontend sin commitear hasta ahora: tercer método de pago con `/pago/transferencia`, páginas Nosotros/Preguntas frecuentes/Envíos/Medios de pago/Contacto, TopBar mobile, envío gratis y plazo de entrega 6-7 días hábiles, Términos 1.6.3 y devoluciones 3.2/3.5. Verificado contra la línea base (build Vite, `tsc -b` 52, lint 67, `deno check` OK) y escaneo de secretos sin matches.
- **2026-10-07** — Fix del layout de `/register` con panel scrolleable en desktop y formulario más compacto (`ccaa8c3`), verificado contra la línea base (build Vite, `tsc -b` 52, lint 67). Rotación del topic de ntfy (app y secret `NTFY_TOPIC` con el mismo valor; el valor no queda documentado), botón flotante de WhatsApp verificado en producción y wallet USDT confirmada por el dueño (la regla de verificar el depósito en Binance antes de confirmar sigue en pie). Versiones de las Edge Functions verificadas con la CLI y este documento actualizado a 2026-10-07.
- **2026-10-06** — Cierre del bloque legal y del arrepentimiento: textos legales publicados con aceptación en checkout y registro (`c5ddfc4`), backend del arrepentimiento con tabla, Edge Function y RPC (`f16ace3`), frontend con página `/arrepentimiento`, constancia, estado en pedidos y pantalla de gestión con contador en el menú (`04be7bb`), arreglos de diseño de las tablas del admin (`925f9b6`) y `.gitignore` ampliado a `.env*` (`00b9ab7`). Verificaciones contra la línea base (build Vite, `tsc -b` en 52, lint en 67) y revisión de secretos sobre todo el diff antes del push. En seguridad: neutralización de la cuenta de QA con rol admin (rol bajado, contraseña aleatoria y bloqueo), auditoría del repo y de su historial sin claves ni tokens expuestos, y constancias de prueba de arrepentimiento borradas con la secuencia reiniciada para que la próxima constancia sea `ARR-000001`.
- **2026-10-05** — Cierre del bloque de QA post-pago: bug del carrito corregido antes de pagar (`8fc4a5c`), variantes de producto con galería propia por variante, dropdown y drag & drop de imágenes con 4 migraciones aplicadas en remoto (`b8dc73a`), backend y frontend del pago USDT con guard 409, ntfy, emails y página `/pago/usdt` (`6f52bc6`), sidebar de subcategorías (`a39767a`), teléfono obligatorio con WhatsApp en el detalle de pedido (`2a5fbb7`) y franja de medios de pago en Home y ficha (`fbd7cff`). Todo commiteado y pusheado; verificación en vivo de RLS, cron de expiración y Edge Functions desplegadas en la BD remota; bug de `useCatalog` confirmado resuelto.
- **2026-10-05** — Cierre del bloque de stock: `cancel_order` con idempotencia por saldo neto y 3 inventarios huérfanos corregidos (`739706e`); guard de pedidos cancelados en pagos + avisos de stock/reembolso en el admin (`4f63f32`); `confirm_sale` al aprobar pagos manuales USDT (`a039a94`); endurecimiento de `create-payment-usdt` y `order-creation` ante fallos, timeouts y errores de release (`6fe9152`). Migraciones aplicadas en remoto; funciones redeployadas (`create-payment` v27, `create-payment-usdt` v11).
- **2026-09-25** — Auditoría inicial completa vía opencode. Diagnóstico: falta conectar pago end-to-end. Enviado prompt de estabilización (commits, bug useCatalog, RLS, .env.example, README).
