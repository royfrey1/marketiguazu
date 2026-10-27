# Iguazú Marketplace — Estado del Proyecto

**Última actualización:** 2026-10-27
**Fuente:** QA manual del usuario + auditoría de opencode con verificación en vivo (repo, BD remota y Supabase CLI) el 2026-10-07

> Este documento es la fuente de verdad de en qué fase estamos. Actualizarlo después de cada sesión de trabajo relevante (no hace falta después de cada micro-tarea).

---

## 🎯 Momento actual

Estamos en la **recta final previa al lanzamiento**: QA de producción, requisitos legales/dominio y verificación final de datos. La tienda opera end-to-end en producción (checkout con Mercado Pago, webhook, páginas de resultado con pedido real), con pago alternativo en USDT (TRC20) probado de punta a punta, **modelo de stock corregido** (reservas por saldo neto, `confirm_sale` al aprobar), variantes de producto con galería propia, sidebar de subcategorías y teléfono de contacto obligatorio. Desde 2026-10-06 los **textos legales están publicados** (con aceptación en checkout y registro) y el **botón de arrepentimiento está completo** (página pública con constancia, estado en el pedido y gestión en el admin). **Dominio propio activo desde 2026-10-13:** la tienda se sirve en `https://www.iguazumarketplace.com.ar` (www es el principal; el apex sin www redirige con 308; `market-iguazu.vercel.app` redirige 301 al dominio nuevo). **Migración completada (2026-10-14):** `SITE_URL`, CORS de las 6 Edge Functions, Auth de Supabase y SMTP propio (Resend) configurados; el remitente de los emails de pedidos usa el dominio propio (`RESEND_FROM_EMAIL` actualizado) y `create-quote` quedó dada de baja en producción (el código sigue en el repo). **Frontend:** notificaciones (Sileo) abajo a la derecha y siempre oscuras, botón ver/ocultar contraseña (`PasswordInput`) en todos los campos de contraseña y avisos de `ResetPasswordPage` corregidos. **Opción base elegible (2026-10-14):** productos con variantes pueden tener una opción "base" opt-in (`products.opcion_base_nombre`) que usa el precio y el stock propio del producto; BD + servidor + frontend completos (ver sección propia). **Protección de precios (2026-10-14):** CHECK `precio > 0` en ambas tablas, las 4 RPCs de admin rechazan precios no válidos, `INVALID_PRICE` en la creación de pedidos y los formularios del admin validan antes de enviar (ver sección propia). **Meta Pixel (2026-10-14):** pixel de Meta instalado con PageView/ViewContent/Search/AddToCart/InitiateCheckout/Purchase — Purchase solo con pago de Mercado Pago aprobado, sin eventos en `/admin` y con guard en el snippet (ver sección propia; falta cargar `VITE_META_PIXEL_ID` en Vercel). El trabajo de esta sesión (protección de precios + Meta Pixel) queda en un solo commit. El trabajo que queda no es de construcción: es completar datos del titular, dominio/emails, rotar secretos y editar datos de catálogo por cuenta del dueño.

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
- **2026-10-07** — **QA manual de punta a punta del pago por transferencia en producción (hecho por el dueño):** creación del pedido, reserva de stock, confirmación manual desde el admin y baja de stock; sin errores funcionales detectados en el flujo. ~~Queda anotado como pendiente, a resolver por el dueño, la limpieza de los datos de ese QA manual (pedidos de prueba y ajuste de stock).~~ **Limpieza completada el 2026-10-08** (ver "Hechos confirmados", pedidos/pagos/envíos en 0).
- **2026-10-07** — **Ajustes visuales del checkout y de las páginas de pago:** selector de medios de pago en fila de 3 desde 1280 px (xl); `/pago/transferencia` solo permite copiar el alias y el CBU (titular y banco son texto fijo); `/pago/transferencia` y `/pago/usdt` en 2 columnas desde 1024 px (lg).
- **2026-10-08** — **SEO base (fase 1):** `<html lang="es">`, meta description y Open Graph/Twitter por defecto en `index.html` (con `noscript`), favicon liviano y `apple-touch-icon`, `public/og-default.png` (1200×630 con el logo sobre el color de marca) y `public/robots.txt` (con `Disallow` de rutas privadas, sin línea `Sitemap` todavía). Componente `Seo` propio sin dependencias (`src/components/seo/Seo.tsx`): título, descripción, canonical, og/twitter, robots y JSON-LD por página, con restauración de los valores por defecto al salir de la ruta. JSON-LD Organization + WebSite (con SearchAction a `/busqueda?q=`) en la Home y Product en la ficha (precio numérico en ARS y disponibilidad según stock real; sin `itemCondition`, sin ratings y sin `sku` porque la tabla `products` no tiene ese campo). `noindex` en carrito, checkout, cuenta, pagos, auth, admin, report, búsqueda (`noindex,follow`) y 404. La URL base vive en una única constante: `SITE_URL` en `src/config/site.ts` — cambiarla al conseguir dominio propio, junto con `robots.txt`, `sitemap.xml`, CORS y `SITE_URL` de Supabase.
- **2026-10-08** — **Correcciones previas al lanzamiento (ficha y home):** la ficha de producto muestra `SKU:` **solo cuando hay SKU real de variante** (se quitaron los fallbacks inventados armados desde el slug y `'DEMO-SKU-001'`) y el JSON-LD de producto incluye `sku` solo si es real; se **eliminó la sección "Reseñas y calificaciones" de ejemplo** (puntaje fijo y reseñas de muestra) de todas las fichas; el copy de garantía en `TrustBar` y `BenefitsSection` pasa a **"garantía legal de 6 meses desde la entrega"** (alineado con Términos 1.4/1.6 y Devoluciones 3.3) — ya no se afirma "garantía oficial". Criterio registrado: **no mostrar puntajes ni reseñas que no sean reales**; si en el futuro se agregan reseñas, deben venir de un sistema real (nada de datos de ejemplo).
- **2026-10-08** — **Datos legales del proveedor cargados en `src/config/legal.ts`** (nombre, CUIT, domicilio, fecha de publicación 1 de noviembre de 2026 y herramienta de analíticas: Vercel Analytics). Aparecen **solo** en Términos 1.1 y Privacidad 2.1 (identificación del proveedor); no se publican en footer, Contacto, Nosotros, Envíos ni metadatos (el domicilio es el domicilio legal del proveedor, no un local de atención al público). La fecha de publicación es futura **a propósito**: la tienda no acepta pedidos antes del 1 de noviembre de 2026. **Chequeo de seguridad del repo (2026-10-08): verificado que `backup/` no está ni estuvo en el historial (ignorado por `.gitignore`), sin archivos sensibles trackeados, sin ramas ni tags distintos de `main`.**
- **2026-10-08** — **Limpieza de datos QA completada en producción (2026-10-08):** pedidos, pagos y envíos en **0** (24 pedidos de prueba con sus items y payments, y 5 shipments eliminados en una transacción con verificación); secuencia de `numero_pedido` **reiniciada** → el primer pedido real será **`PED-00001`**; productos QA **1007** y **1008** eliminados con sus inventarios y los 12 movimientos asociados (quantity total 369 → 363); **cuentas de prueba eliminadas** (quedan 1 usuario y 1 perfil: solo la cuenta admin, con sus 2 direcciones, su carrito con 1 item y su favorito intactos); avatares ajenos eliminados del bucket (queda 1); la función `qa_reset_admin_order` (SECURITY DEFINER) fue eliminada por la migración `20261008090000_drop_qa_functions.sql` — 0 funciones `qa_*` en la BD. **Stock real confirmado por el dueño: producto 1009 = 8, producto 1037 = 4 (sin ajuste).** Backup de todo lo borrado en `backup/` (ignorado por git). **Nota: las migraciones `qa_*` quedan en el historial del repo — no ejecutar en bases nuevas** (contienen emails y contraseñas literales de cuentas de prueba).
- **2026-10-14** — **Carrito: confirmación al quitar + "Deshacer":** al quitar una línea (papelera o "-" con cantidad 1) se abre un modal de confirmación (Modal compartido) con foto, título, rótulo y cantidad; casilla "No mostrar este mensaje otra vez" (preferencia por dispositivo en `localStorage`, clave `iguazu_cart_skip_remove_confirm`; solo se guarda al confirmar con la casilla tildada). Tras quitar aparece un aviso Sileo con **"Deshacer" (7 s)** que restaura la línea exacta (misma variante u opción base, misma cantidad) por el camino normal de `addToCart` respetando stock (sin stock: avisa; stock parcial: restaura lo posible y avisa). Memoria de hasta 5 eliminaciones válidas 10 s; Deshacer restaura la más reciente y encadena el aviso de la anterior; se descartan al salir del carrito. Punto de entrada único: `useRemoveCartItem` + `CartRemovalProvider`; `removeItem` del `CartProvider` devuelve `Promise<boolean>`.
- **2026-10-14** — **Carrito de invitado visible (opción B):** `/carrito` dibuja el carrito de invitado (localStorage `iguazu_cart`, forma de línea sin cambios y compatible con carritos viejos) con lectura saneada (JSON roto ⇒ vacío, líneas inválidas descartadas, cantidad 1-999, máximo 30 líneas, duplicados unidos), enriquecido por **1 consulta de productos** (con embeds de fotos y variantes) más RPC públicas de disponibilidad (peor caso **31 llamadas** con 30 líneas, una vez por visita a `/carrito`). Misma UI que el carrito logueado (`CartItemCard`, rótulos, fotos por variante, modal de quitar + Deshacer). Precio mostrado = vigente (aviso "El precio cambió" si difiere del guardado); es informativo, el servidor cobra con el precio de la base. Líneas no disponibles o con cantidad mayor al stock bloquean "Continuar". Corregido el bug de `removeItem`/`updateQuantity` de invitado por `product_id` (ahora línea exacta producto+variante|base). **Continuar siendo invitado:** guarda precios vigentes en las líneas locales y va a `/login?redirect=/checkout` con aviso "Iniciá sesión para finalizar tu compra. Tu carrito se guarda."; el enlace a registro conserva el retorno. Retorno seguro solo a rutas internas (`safeInternalPath` rechaza `//host`, barras invertidas, URLs absolutas y `javascript:`). `ProtectedRoute` ahora agrega `?redirect=` para cualquier ruta protegida (perfil, pedidos, checkout). `CartMergeModal` sin cambios.
- **Commits recientes (todos pusheado al cerrar esta sesión):** `8fc4a5c`, `b8dc73a`, `6f52bc6`, `a39767a`, `d1ba6cc`, `2a5fbb7`, `fbd7cff`, `739706e`, `4f63f32`, `a039a94`, `6fe9152`, `c5ddfc4`, `f16ace3`, `04be7bb`, `925f9b6`, `00b9ab7`, `ccaa8c3`.

---

## 🚨 Bloqueadores críticos (antes del lanzamiento, resolver en este orden)

1. ~~**Datos del titular en `src/config/legal.ts`**~~ — **cargados** (2026-10-08) salvo la condición fiscal: razón social, CUIT, domicilio, plazo de entrega, analíticas y fecha de publicación (1 de noviembre de 2026) están completos. Queda el bloqueador: **`CONDICION_FISCAL`** — el dueño aún no está inscripto en ARCA; hasta entonces Términos 1.5 muestra el texto entre corchetes "[CONDICION FISCAL]". Se completa con la condición real (monotributista con categoría, responsable inscripto o exento; **no** "Consumidor Final") cuando se inscriba. **Debe resolverse antes del 1 de noviembre de 2026** (la fecha de publicación es a propósito: la tienda no acepta pedidos antes de ese día).
2. **Dominio propio** — **activo desde 2026-10-13**: `https://www.iguazumarketplace.com.ar` es el principal (www), el apex sin www redirige con 308 y `market-iguazu.vercel.app` redirige 301 al dominio nuevo. **Configuración completada (2026-10-14):** secret `SITE_URL` al dominio nuevo, CORS de las 6 Edge Functions (create-payment, create-payment-usdt, create-payment-transfer, send-order-email, admin-verify-payment, request-withdrawal) con ambos orígenes (www + apex), `site_url` y redirects de Supabase Auth al dominio nuevo, SMTP propio de Supabase Auth configurado y dominio verificado en Resend (SPF/DKIM); `RESEND_FROM_EMAIL` actualizado con el remitente del dominio propio (`pedidos@iguazumarketplace.com.ar`). `create-quote` **dada de baja en producción** (2026-10-14): el código queda en el repo; reconectarla solo con rate limit y cache del token de Correo Argentino. **Quedan pendientes:** **(c)** variable `VITE_APP_URL` en Vercel = `https://www.iguazumarketplace.com.ar` (alimenta el link de reset de password) y **(d)** panel de Mercado Pago — revisar que la integración (webhook/notificaciones y dominios) acepte el dominio nuevo.
3. **Rotar `MP_WEBHOOK_SECRET`**.
4. ~~**Cuenta de QA con rol customer y datos de prueba**: borrar o banear la cuenta (queda activa hasta que termine el QA en producción), limpiar productos 1007/1008, pedidos y pagos fixture, y reponer a mano el stock afectado por los pedidos de prueba.~~ — **resuelto** (2026-10-08): cuentas de prueba eliminadas (queda solo la cuenta admin), productos 1007/1008 y todos los pedidos/pagos fixture borrados; stock real confirmado por el dueño (1009 = 8, 1037 = 4, sin ajuste).
5. **Primer pago USDT real**: confirmar en Binance que el depósito entró ANTES de apretar "Confirmar pago recibido" (la dirección de la wallet fue confirmada por el dueño como correcta, pero nunca se probó con un depósito real).
6. **Variable `VITE_META_PIXEL_ID` en Vercel** (Settings → Environment Variables → solo entorno **Production** + redeploy sin cache): con la variable vacía o ausente el snippet de `index.html` no carga fbevents ni envía nada y el Meta Pixel no trackea en producción. Después de cargarla, verificar con Meta Pixel Helper y "Probar eventos" del Administrador de eventos.

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
| 12 — SEO/Performance | 🔶 Parcial | **Fase 1 hecha (2026-10-08):** `lang="es"`, meta description/OG/Twitter por defecto, `robots.txt`, metadatos y JSON-LD por página, `noindex` en rutas privadas. Quedan `sitemap.xml` (fase 2), la vista previa Open Graph de producto en WhatsApp/Facebook y performance |
| 13 — Lanzamiento | ⬜ No iniciada | Dependiente de los bloqueadores de arriba |

**Edge Functions desplegadas** (verificadas con `supabase functions list` el 2026-10-14): `create-payment` (v42), `mp-webhook` (v31), `admin-verify-payment` (v23), `create-payment-usdt` (v26), `create-payment-transfer` (v10), `send-order-email` (v23), `request-withdrawal` (v14) — todas ACTIVE. `create-quote` solo existe en el repo (no desplegada).

---

## 🏷️ Ofertas (2026-10)

**Modelo:** columna `en_oferta` en `products` y `product_variants`; CHECKs de descuento real (`precio_anterior > precio`) y tope del 90% (`precio_anterior <= precio * 10`); índices parciales sobre `en_oferta AND activo`. `precio` es el precio vigente (el de oferta) y `precio_anterior` el normal, así el checkout no cambia (no hay segundo campo de precio).

**Regla:** un producto **sin variantes activas** tiene la oferta a nivel producto; un producto **con variantes activas** tiene la oferta por variante (el flag del producto se ignora y marcarlo da error).

**Vista `products_ofertas`** (con `security_invoker`, lectura para `anon`/`authenticated`) que usan las listas de la tienda: `en_oferta_efectivo`, `oferta_precio`, `oferta_precio_anterior`, `oferta_descuento`, `oferta_variantes_count` y `oferta_variant_id`.

**RPCs de admin** recreadas con el parámetro `p_en_oferta` (en las CREATE con default `false`; en las UPDATE con default `NULL` = no cambiar). Quedan `SECURITY DEFINER`.

**Admin:** sección `/admin/ofertas` y campo de oferta en producto y variante; advertencia de UI desde el 50% de descuento.

**Tienda:** tarjetas, ficha (según la variante seleccionada, `?variante=<id>`), bloque de la home, ruta `/ofertas` y filtro "Solo ofertas" en `/busqueda` (estilo violeta/fucsia solo en ese modo).

**Regla visual única:** tachado, porcentaje y badge solo si la oferta está marcada **y** `precio_anterior > precio`.

**Sin fechas de inicio/fin:** las ofertas se manejan a mano.

**Pendientes anotados:**

- Filtro "Solo ofertas" en `/categoria`.
- Fechas de inicio y fin de la oferta.
- Link "Ofertas" en navbar y footer.
- El filtro `cat` de `/busqueda` no incluye subcategorías (`CategoryPage` sí).
- Página fuera de rango en `/busqueda` muestra "Requested range not satisfiable".
- `products.precio` no se sincroniza con el precio de las variantes (hay desfasajes en algunos productos; los corrige el dueño desde el admin).
- Los productos en oferta sin stock no aparecen en las listas.

---

## 🧩 Opción base elegible (2026-10)

**Modelo:** columna `products.opcion_base_nombre` (`NULL` = apagada; CHECK 1-60 caracteres). Un producto con variantes activas puede habilitar una opción "base" que representa comprar el producto tal cual (sin elegir variante): usa `products.precio` y el **stock de la fila base** de `inventory` (`variant_id IS NULL`, ya cargable vía `adjust_stock`). La opción base **no entra en ofertas** (la regla de ofertas por variante queda intacta).

**BD + servidor (aplicado en producción 2026-10-14, migración `20261014100000_product_base_option.sql`):**

- `get_product_availability` suma el stock base **solo** cuando `opcion_base_nombre` tiene valor (los productos sin nombre se comportan igual que antes).
- RPC nueva `get_product_base_availability(p_product_id)` → `{opcion_base_nombre, available}`.
- `create_admin_product` / `update_admin_product` con `p_opcion_base_nombre` (NULL = no cambiar, `''` = quitar).
- Regla de servidor en `_shared/order-creation.ts`: un item sin variante de un producto con variantes activas y sin opción base se rechaza con `INVALID_VARIANT` ("Seleccioná una variante del producto"). Las 3 funciones de pago (`create-payment`, `create-payment-usdt`, `create-payment-transfer`) fueron redeployadas.

**Frontend:**

- Admin: campo "Nombre de la opción base" en la edición de productos con variantes activas (vacío = apagada; guardar otros campos conserva el valor).
- Ficha: la opción base aparece **primera** en el selector de variantes, con precio del producto, stock de la fila base y sin oferta; se agrega al carrito sin `variantId`.
- Carrito: la muestra con su nombre como línea aparte y bloquea items sin variante de productos con variantes y sin opción base.
- Inventario: rotula la fila base ("Opción base: `<nombre>`" o "Producto base (sin variante)").
- Selector de variantes a 44 px por debajo de `lg`.
- Carrito/checkout: la línea de la opción base se rotula con el mismo atributo que las variantes cuando todas las variantes activas tienen un único atributo de igual nombre (ej. "Color: Gris acero"); si no, solo el nombre. Las variantes muestran su foto propia (galería de la variante, luego `imagen_url` heredada, luego la del producto); la base usa la del producto. Las líneas del mismo producto se muestran juntas (base primero). El rótulo también aparece en el resumen y en la revisión del checkout (es orden de presentación: no cambia el total ni los items).
- Portada de producto: sale **solo** de la galería propia (`product_images` con `variant_id NULL`); fallback a `imagen_url` del producto y luego a la principal de la primera variante activa; si no hay nada, ícono de categoría. Corrige que la portada de las tarjetas/SEO pudiera ser la foto de una variante. En la ficha, con una opción elegida que no tiene fotos, el respaldo es solo la foto propia del producto.

**Pendientes anotados:**

- Botones "Ajustar stock" / "Historial" de Inventario a 28 px en mobile.
- ~~Proteger variantes con precio 0 o vacío (admin y BD)~~ — **resuelto** (2026-10-14): CHECK `precio > 0` en `products` y `product_variants`, validación en las 4 RPCs admin (`El precio debe ser mayor a 0`) y `INVALID_PRICE` en la creación de pedidos (migración `20261014160000_price_must_be_positive.sql`, aplicada; 3 Edge Functions redeployeadas).
- Advertencia al agregar la primera variante a un producto con stock propio (el stock base deja de contar).
- Ofertas para la opción base (futuro).
- Configurar la opción en productos reales (1053 primero) tras verificar que `products.precio` sea correcto.
- Precios base desfasados de los productos 8 y 1023.
- Confirmar visualmente en producción la ficha de un producto sin fotos propias (fallback de portada).
- Confirmación/aviso al eliminar un producto del carrito (próximo).

---

## 💰 Protección de precios (2026-10)

**BD + servidor (migración `20261014160000_price_must_be_positive.sql`, aplicada en producción 2026-10-14):**

- CHECK `precio > 0` en `products` y `product_variants` (reemplaza los CHECKs previos `precio >= 0`).
- Las 4 RPCs de admin (`create_admin_product`, `update_admin_product`, `create_product_variant`, `update_product_variant`) rechazan precio <= 0 con `'El precio debe ser mayor a 0'` (ERRCODE 22023).
- Defensa en la creación de pedidos (`supabase/functions/_shared/order-creation.ts`): un item con precio <= 0 se rechaza con `INVALID_PRICE` ("Este producto no está disponible por el momento"), sin exponer detalles.
- Redeploy de las 3 funciones de pago (`create-payment`, `create-payment-usdt`, `create-payment-transfer`) y test de la regla con mocks: `node supabase/functions/_shared/order-creation.test.ts` 10/10 PASS.

**Frontend (admin):**

- `src/lib/priceRules.ts` centraliza la regla (la misma del CHECK); los formularios validan antes de enviar: `ProductForm`, `ProductBasicFields`, `ProductCreatePage`, `ProductEditPage`, `VariantFormDialog`, `ProductVariantsManager`, `AddOfferDialog` y el generador de combinaciones (`VariantCombinationGenerator`).

---

## 📈 Meta Pixel (2026-10)

**Instalado (2026-10-14):** pixel de Meta (el ID vive solo en la variable de entorno `VITE_META_PIXEL_ID`, nunca en el repo), sin dependencias nuevas y sin datos personales hacia Meta (solo ids/nombres de producto, búsquedas, cantidades y montos en ARS).

- **Base:** snippet oficial en el `<head>` de `index.html` con **guard**: solo se carga `fbevents` y se inicializa si el ID reemplazado es numérico (vacío o placeholder → no se carga ni se envía nada, incluido el `<noscript>`). El PageView inicial **no se emite en `/admin`**. Documentada en `.env.example` y README; en Vercel va en Settings → Environment Variables, **solo Production**, con redeploy sin cache.
- **autoConfig desactivado (2026-10-14):** en el snippet se hace `fbq('set', 'autoConfig', false, pxid)` antes del `fbq('init', ...)` para que Meta no registre `SubscribedButtonClick` ni metadatos de página (solo se emiten los eventos de `src/lib/metaPixel.ts`); además el usuario desactiva en Meta Events Manager → Configuración las "Coincidencias de sitio web automáticas". **Pendiente de seguimiento:** si en Probar eventos siguen apareciendo `SubscribedButtonClick` tras el deploy, revisar.
- **Helper único:** `src/lib/metaPixel.ts` (`trackMetaEvent`, `trackPurchaseOnce`, `shouldTrackPageView`, `isPurchaseApproved`): no rompe si `window.fbq` no existe (adblocker) ni corre en servidor; `Purchase` deduplicado por pedido con `sessionStorage` + Set en memoria.
- **Eventos:** `PageView` por cambio de ruta (`src/components/layout/MetaPixelPageView.tsx`, montado en `App.tsx`; excluye `/admin` y no duplica el de carga inicial); `ViewContent` y `AddToCart` en `ProductPage.tsx`; `Search` en `SearchPage.tsx` y `CategoryPage.tsx` (una vez por término); `InitiateCheckout` en `CheckoutPage.tsx` (una vez por visita, con items y total); `Purchase` **solo en `PaymentSuccessPage`** y solo cuando el pedido se muestra con `payment_status = approved` (si la página de éxito se ve con el pago pendiente/en proceso por el webhook, no se emite; un pedido cancelado tampoco). **Sin Purchase en `/pago/usdt` ni `/pago/transferencia`** (se confirman a mano) ni en pendiente/fallo.
- **Verificación (2026-10-14):** mini-harness local sin red (snippet con `window.fbq` simulado: admin sin PageView, Purchase solo con pago aprobado y una sola vez, Usdt/Transfer sin Purchase, ID no numérico no carga nada, restos de eventos intactos) + build OK + `npx tsc -b` 50 y lint 66 = línea base. En producción: Meta Pixel Helper (extensión) y "Probar eventos" del Administrador de eventos de Meta.

**Pendientes del Pixel:**

- **Purchase de transferencia/USDT desde el servidor al confirmar la aprobación** (Meta Conversions API): hoy no se emite en esas pantallas.
- **Revisar política de privacidad / consentimiento por el uso del Pixel** (cookies de seguimiento de Meta).
- ~~Cargar `VITE_META_PIXEL_ID` en Vercel~~ **(resuelto 2026-10: ya está cargado, solo Production, y activo en producción)**; queda verificar con Meta Pixel Helper y "Probar eventos".
- Botones del carrito (cantidad/papelera/"Continuar") a **44 px en mobile**.

---

## 🍪 Consentimiento de cookies / Pixel opt-in (2026-10)

**Con consentimiento (2026-10-14):** el Pixel de Meta pasa a opt-in; sin nueva dependencia ni datos personales.

- **Clave:** `localStorage` `iguazu_cookie_consent`, **vence a los 12 meses** (si está vencida o ausente, nada se carga y se vuelve a mostrar el banner).
- **Banner y panel de preferencias:** `CookieBanner.tsx` (Acepto/Rechazo) + panel de preferencias abierto desde el Footer (`useCookieConsent.ts` + evento `iguazu:cookie-preferences-open` en el layout); cambios avisados por `iguazu:cookie-consent-change`.
- **Carga dinámica del Pixel:** el snippet ya no está en `index.html` (que queda sin "facebook" ni "fbq"): `src/lib/metaPixel.ts` inyecta `connect.facebook.net` **solo** con consentimiento `granted`; sin `fbq` cargado los eventos quedan en no-op (adblocker ya era caso).
- **Revocación:** al pasar a `denied`/vencido se borran las cookies `_fbp` y `_fbc`; además los eventos (`trackMetaEvent`) se descartan si no hay consentimiento `granted`.
- **Purchase:** igual que antes, **solo con Mercado Pago `approved`** (`isPurchaseApproved`), deduplicado; cancelado/pago no aprobado → sin evento. Sin cambios de backend (migraciones y Edge Functions intactas en esta tanda).
- **`/privacidad` actualizada:** `src/content/legal/privacidad.md` (base técnica, **requiere revisión profesional**); fecha en `PRIVACY_LAST_UPDATED` de `PrivacyPage.tsx`; enlaces en `LegalPage.tsx`.
- **Vercel Analytics:** el sitio usa `@vercel/analytics` (**NO** usa Speed Insights; si se agrega, hay que sumarlo a `/privacidad`); la política lo describe como medición **agregada "según el proveedor"**; la afirmación de que la medición **no depende del aviso de cookies** es **una decisión nuestra** y queda **sujeta a revisión profesional** de la política; la **tabla de cookies** de `/privacidad` tiene **7 filas** y debe mantenerse **alineada con el código**.

**Pendientes del consentimiento:**

- **Revisión profesional de la política de privacidad** (base técnica, no asesoramiento legal).
- **ARCA en el texto de `/privacidad`:** confirmar que corresponde cuando se inscriba (hoy "ARCA" no aparece fuera de `legal/`).
- Desactivar en Meta Events Manager → Configuración las **"Coincidencias de sitio web automáticas"**.
- Verificar con Meta Pixel Helper y "Probar eventos" que sin aceptar no se envía nada y con aceptar aparece PageView + eventos.

---

## 📐 Escala 90% del storefront + galería sticky (2026-10)

**Aprobado y commiteado (2026-10-21):** escala visual del storefront en tablet/escritorio + galería fija en la ficha de producto. Sin backend, sin dependencias nuevas.

- **Escala:** `font-size` de `html` al **90%** desde **48rem de ancho y 31.25rem de alto** (`src/index.css`), **excepto** `<html data-area="admin">` (el admin queda al **100%**). El atributo lo pone `main.tsx` antes del primer render y `RouteAreaSync.tsx` lo actualiza al navegar (lógica en `src/lib/routeArea.ts`, `getAreaForPath`). **Mobile no cambia** (menos de 768 px y celulares apaisados): verificado por hash de estilos calculados (24 casos). Los breakpoints de Tailwind no se mueven (usan rem en media queries) y las columnas quedan iguales (40 casos).
- **Tokens táctiles:** `--spacing-tap` (clases `min-h-tap`, `h-tap`, `w-tap`, `min-w-tap`) = **2.75rem**; en pantallas táctiles (`pointer: coarse`) = **max(2.75rem, 44px)**. `--text-xs` con **piso de 11px**. **Regla para código nuevo:** objetivos táctiles de **44 px** con las clases `*-tap` (no `min-h-11`), y evitar `text-[Npx]` chicos.
- **Galería sticky en `ProductPage`:** variante **lg-tall** (ancho >= 64rem y alto >= 37.5rem), `top-28`, se suelta al terminar el bloque de dos columnas (el botón "Agregar al carrito" es lo último de la columna derecha). `scroll-mt-28` en la columna de información para que Tab no quede tapado por el header.

**Pendientes de la escala:**

- Probar los botones en una **tablet táctil real** (la prueba táctil fue simulada).
- La grilla de la ficha `lg:grid-cols-[1fr_380px]` **no escala** con el 90% (opcional: pasar a `23.75rem`).
- `scroll-padding-top` global para el header sticky en todo el sitio (Tab).
- Mega menu con anchos en px (opcional).
- `/login` se ve al 90% también cuando entra el admin (menor).

---

## 🗑️ Papelera y borrado definitivo de productos (2026-10)

**Backend (migración `20261022120000_product_trash.sql`, aplicada en producción 2026-10-22):**

- `products.deleted_at` (soft delete) + índice parcial + CHECK `products_trash_inactive_chk`: **papelera implica `activo = false`** (la tienda nunca la ve; el CHECK lo garantiza incluso ante escrituras directas).
- RPCs admin (SECURITY DEFINER, con EXECUTE para `authenticated`/`service_role` y **sin** EXECUTE para anon): `archive_admin_product`, `restore_admin_product`, `get_admin_product_delete_info` y `delete_admin_product_permanent(p_product_id, p_confirm_stock_loss)`. Códigos de error: `P4003 FORBIDDEN`, `P4004 PRODUCT_NOT_FOUND`, `P4041 ALREADY_IN_TRASH`, `P4042 NOT_IN_TRASH`, `P4043 PRODUCT_IN_TRASH`, `P4091 HAS_SALES`, `P4092 IN_CARTS`, `P4093 STOCK_CONFIRM_REQUIRED`; el slug ocupado salta como `23505 products_slug_key` (el slug sigue tomado aunque el producto esté en la papelera).
- RLS: `products_admin_all` (ALL, incluía DELETE directo) reemplazada por policies admin de SELECT/INSERT/UPDATE; **el DELETE directo sobre `products` ya no existe: el borrado definitivo es solo por la RPC**.
- `inventory_admin_view` excluye la papelera; `update_admin_product` rechaza editar productos en papelera (`PRODUCT_IN_TRASH`).
- Policy de Storage `storage_objects_admin_delete_publicaciones`: el admin puede borrar archivos del bucket `publicaciones` (la policy anterior solo permitía carpetas con el uid del propio usuario, por lo que el borrado de imágenes desde el admin no borraba los archivos de la raíz del bucket).

**Reglas del borrado definitivo:**

- Solo desde la papelera (si no, `NOT_IN_TRASH`).
- Bloqueado si hay ventas (`HAS_SALES`) o si el producto está en carritos (`IN_CARTS`).
- Con stock > 0 exige confirmación explícita (`STOCK_CONFIRM_REQUIRED`; el frontend pide escribir el nombre exacto del producto).
- Orden: primero la base de datos (la RPC limpia `inventory_movements` → `inventory` → `price_history` → `cart_items` → `product_images` → `product_variants` → `products` y devuelve `storage_files` con los nombres de imagen del bucket), después Storage con esos nombres; la RPC **nunca** borra archivos de Storage.
- Retención de la papelera: manual (sin purga automática).

**Frontend (admin):**

- Pestañas **Productos | Papelera** en `/admin/productos`, con buscador y filtros propios por pestaña.
- Modal de borrado (`DeleteProductDialog.tsx`) con resumen (ventas, carritos, stock, variantes, imágenes) y bloqueos; con stock > 0 pide escribir el nombre exacto para habilitar "Eliminar definitivamente".
- Un producto en papelera queda de **solo lectura por URL** (editar lanza `PRODUCT_IN_TRASH`).
- Categorías muestran "(M en papelera)"; dashboard, ofertas y buscadores del admin excluyen la papelera; `productsService.remove()` (código sin llamadas) eliminado.
- **Hotfix (2026-10-22):** la tabla de productos de escritorio estiraba el documento por un `sr-only` sin ancestro posicionado (`position: absolute` respecto del `body`); corregido agregando `relative` al botón de papelera; afectaba solo `/admin/productos`, pestaña Productos, desde 1024 px (regresión del commit `3523137`).
- **Fix de borrado definitivo con variantes (2026-10-22):** la limpieza de dependientes se hacía solo por `product_id` y `price_history` tenía filas alcanzables solo por `variant_id` (su CHECK exige XOR `product_id`/`variant_id`), así que borrar un producto con variantes fallaba con `price_history_variant_id_fkey` (caso real: producto 8, 5 filas); corregido en la migración `20261022180000`; las pruebas ahora incluyen fixtures con dependientes ligados solo por variante; regla: toda limpieza de dependientes de variantes debe usar el conjunto de ids de variantes, no solo `product_id`.

**Reversa:** `backup/2026-10-22-papelera/revert.sql` (local, ignorado por git; ensayado en transacción con ROLLBACK contra producción antes de aplicar).

**Línea base nueva:** `npx tsc -b` = **49** (bajó de 50 porque se arregló el dashboard); lint **66 (57 errores, 9 warnings)** y build OK siguen igual.

**Pendientes nuevos/menores:**

- El "Deshacer" de **Enviar a papelera** restaura el producto como **inactivo**, aunque antes estuviera activo (reactivar es una decisión explícita).
- Insignia "Oferta" visible en la papelera (archivar no apaga `en_oferta`; en la tienda no se ve).
- La X de cierre del `Modal` compartido mide 30 px (no 44).
- El aviso parcial de Storage (tras un borrado definitivo) cuenta también archivos que ya no existían en el bucket.
- Tabla `_legacy_categorias` sin uso (conservada por decisión).
- Renombrar las 5 categorías sin tilde (Perifericos, Fuentes de Alimentacion, Microfonos, Camaras, Consolas portatiles) lo hace el **dueño desde el admin** (el slug no cambia al editar).
- Limpiar el `precio_anterior` huérfano del producto **1023** desde el admin.
- Posibles archivos huérfanos históricos en el bucket `publicaciones` por el permiso anterior de Storage (revisar a futuro).

---

## ✅ Selección múltiple y acciones masivas (2026-10)

Solo frontend: sin migraciones ni cambios de backend (las acciones masivas reutilizan las RPC individuales existentes).

**Papelera:**
- Casillas por fila (tabla de escritorio y tarjetas mobile) y casilla de cabecera con estado intermedio; Shift+click selecciona el rango; la selección persiste entre páginas y se limpia al cambiar de pestaña, búsqueda o categoría.
- Barra de acciones **sticky dentro del área que scrollea** (nunca `fixed`, para no estirar el documento — regla de QA de la sección anterior).
- "Seleccionar los N de la papelera" cuando se marca toda la página visible y hay más de una página.

**Restaurar en masa:**
- Confirmación previa, proceso de a uno con barra de progreso y resumen final; los restaurados quedan **inactivos** (misma regla que el "Deshacer" individual).

**Eliminar definitivamente en masa:**
- Revisión previa con `getDeleteInfo` (concurrencia 4) separando eliminables de bloqueados (ventas / en carritos); si hay stock, confirma escribiendo **ELIMINAR**; borra de a uno con botón **Detener**; limpia Storage por producto; resumen final; los fallidos quedan seleccionados.

**Mensajes amables:**
- `FriendlyError` con detalle técnico plegable para errores inesperados en borrado individual, masivo y restaurar.

**Piezas reutilizables (conectadas en Papelera, Productos e Inventario):**
- `useRowSelection(resetKey)`, `SelectionCheckbox`, `BulkActionBar`, `BulkProgress`, `FriendlyError` (con la nueva prop opcional `detail` para el detalle técnico plegable).
- De la Etapa 2B: `BulkPriceChangeDialog`, `PriceChangePreview`, `UndoPriceChangeDialog`, `RecentPriceChangesDialog`; el cálculo de modos/redondeo y las reglas de exclusión viven en `src/lib/priceChange.ts` y el contrato de las RPC en `src/services/priceChange.service.ts`.
- De la Etapa 3: `BulkStockChangeDialog`, `StockChangePreview`, `UndoStockChangeDialog`, `RecentStockChangesDialog`; los tipos y el contrato de las RPC en `src/lib/stockChange.ts` y `src/services/stockChange.service.ts`; `applyInventoryFilters`/`addBaseRowInfo` exportados desde `inventory.service.ts`; `Pill` (de `PriceChangePreview`) y `Alert` (de `BulkPriceChangeDialog`) ahora exportados.

**Productos masivo (Etapa 2A):**
- Pestaña Productos: casillas por fila/cabecera/tarjetas mobile con Shift+click; la selección persiste entre páginas y se limpia al cambiar de pestaña, búsqueda, categoría, estado, oferta u orden; "Seleccionar los N productos (filtrados)" con `getProductItems` (solo lectura, de a 1.000, excluye papelera).
- **Activar/Desactivar masivo:** `setActiveMany` = UPDATE de la columna `activo` en tandas de hasta 100 con `.in('id')` y `.select('id')` + `clearAvailabilityCache()`; replica el toggle individual (UPDATE directo, sin validaciones extra); los ids que no vuelven se reportan como "ya no existe"; si una tanda falla se reintenta de a uno; el CHECK de papelera se mapea a un mensaje amable; sin botón Detener.
- **Enviar a la papelera masivo:** `archive_admin_product` de a uno con progreso, botón Detener, modal **no descartable** mientras corre, resumen de enviados/no enviados; sin "Deshacer" (recuperación: Papelera → Restaurar masivo → Activar masivo).
- Los procesados con éxito — y los que fallan por "ya en papelera", "ya no existe" o CHECK de papelera — salen de la selección; los demás fallidos quedan seleccionados.

**Modal compartido:**
- Nueva prop `dismissible` (default **true** → sin cambio de comportamiento para los modales existentes); en `false` bloquea Esc, click afuera y la X, con parche contra el cierre de Chrome ante Esc repetidos.

**Pendientes nuevos:**
- Bulk en la tabla de Productos: **Etapa 2A hecha** (activar/desactivar y enviar a papelera) y **Etapa 2B hecha** (cambio masivo de precios, ver sección propia); falta **destacar**.
- ~~Bulk en Inventario: cambios de stock con RPC que registre `inventory_movements`~~ — **Etapa 3 hecha** (cambio masivo de stock, ver sección propia).
- Barra de acciones en mobile ocupa ~238 px (acortar etiquetas, p. ej. "Papelera").
- Tandas de más de 100 ids no probadas (probar con 250 simulados en la Etapa 2B).
- "En oferta" mide 38 px en mobile (preexistente); la columna Categoría se parte en dos renglones a 1269 px por la columna de casillas.
- Activar/Desactivar sin botón Detener (decisión de la 2A).
- Revisar el parche del `Modal` si se agregan más modales no descartables; el borrado individual sigue permitiendo Esc mientras corre.
- Restaurar masivo sin botón Detener (decisión: no hace falta).
- `getTrashItems` (solo lectura, hasta 1.000) para el "Seleccionar los N".
- Títulos de avisos de Sileo capitalizados (preexistente).
- **Convención QA reafirmada:** en toda pantalla del admin, `document.documentElement.scrollHeight == window.innerHeight`.

**Plan Etapa 2B (cambio masivo de precios) — decisiones del dueño:**
- Tres modos: porcentaje, monto fijo y precio exacto; redondeo opcional (Ninguno por defecto, $10, $100, $1.000).
- Aplica a **todas** las variantes de cada producto seleccionado (y al precio base); precio exacto en productos con variantes las deja al mismo precio, con aviso en la vista previa.
- Productos cuyo nuevo precio deje la oferta inválida se marcan en la vista previa y **NO** se modifican (el dueño los resuelve a mano).
- Vista previa "antes → después" obligatoria; aplicación **atómica** (todo o nada) con registro en `price_history`; botón **Deshacer** obligatorio en el aviso final.
- Backend con RPC nueva respetando `precio > 0` y papelera.

---

## 💰 Cambio masivo de precios (Etapa 2B) (2026-10)

### Backend (migración `20261023120000_bulk_price_change.sql`, aplicada 2026-10-23)

- **Tabla `price_change_batches`**: lotes con `created_by`, `meta` (auditoría: modo/valor/redondeo), contadores de productos/variantes, `undo_of` (lote padre de un deshacer) y `undone_at`/`undone_by`. RLS activo con SELECT solo para admin; sin policies de escritura (la escritura es solo vía RPC).
- **`price_history.batch_id`**: columna FK a la tabla de lotes + índice parcial `WHERE batch_id IS NOT NULL`. El CHECK de `origen` ya admitía `'bulk_update'`; el XOR product/variant quedó intacto.
- **3 RPC** (`SECURITY DEFINER`, `search_path = public, pg_temp`; EXECUTE solo `authenticated` y `service_role`):
  - `apply_price_change_bulk(p_items jsonb, p_meta jsonb)`: **solo cambia la columna `precio`** (nunca `precio_anterior` ni `en_oferta`); **todo o nada**; concurrencia optimista con `expected_precio` por fila; bloqueo `SELECT ... FOR UPDATE ORDER BY id` en products y variantes (anti-deadlock); máximo **500 filas** por llamada (productos + variantes, sin partir el lote); registra `price_history` con `origen='bulk_update'`, `user_id` y `batch_id` (XOR intacto); las filas cuyo precio no cambia se cuentan `unchanged` sin historial ni lote.
  - `undo_price_change_bulk(p_batch_id)`: restaura el precio del historial del lote; salta las filas cuyo precio se alteró después (`precio_cambiado`) o que ya no existen (`no_existe`); crea un lote hijo con `undo_of` y marca el original con `undone_at` (solo si restauró algo); no se puede deshacer un deshacer.
  - `list_recent_price_batches(p_limit)`: últimos 10 lotes (máx. 50) para la UI.
- **Tests**: 69/69 aserciones dentro de una transacción con ROLLBACK (fixtures descartables, cero escrituras reales); lote sintético de 500 filas en **~163 ms** (timeout del rol `authenticated` = 8 s); `update_admin_product`, `update_product_variant` y `delete_product_variant` sin cambios (md5 idénticos).
- **Códigos de error** (PostgREST los expone como `code`, `message` y `details`): `P4003` no admin; `P4094` lote inválido (vacío, >500 filas, meta >2 KB); `22023` precio inválido; `P4095` no existe / variante ajena / id duplicado; `P4043` en papelera; `P4096` precio cambiado (concurrencia optimista y doble envío); `P4097` la oferta quedaría inválida; `P4098` lote inexistente; `P4099` ya deshecho o es un deshacer. Con varios problemas el `code` es el de mayor prioridad (**P4095 > P4043 > P4096 > P4097**) y `details` trae `{"problems":[{"product_id","variant_id","motivo"}]}`.

### Frontend

- Botón **"Cambiar precios"** en la barra de selección de Productos (no en la Papelera).
- Modos **porcentaje** (subir/bajar), **monto fijo** (sumar/restar) y **precio exacto**; redondeo opcional: Ninguno (peso entero), $10, $100, $1.000 (mitad hacia arriba).
- Aplica a **todas** las variantes de cada producto (activas e inactivas) y al precio base.
- **Vista previa obligatoria** "antes → después" con contadores, filtros e insignias; **exclusión por producto entero** (no se modifica nada del producto) si una oferta quedaría inválida, el precio resultante es ≤ 0, el producto está en la papelera o ya no existe.
- En modo precio exacto con variantes de precios distintos, **casilla obligatoria** de confirmación; aviso destacado cuando un cambio supera 50%.
- Se envían **solo los productos con cambios, con todas sus filas**; tope de 500 filas **bloqueado en la UI** (nunca se parte el lote); aplicación en **una sola llamada** con modal **no descartable**.
- Aviso final con botón **Deshacer** y diálogo **"Cambios recientes"** (últimos 10 lotes; el Deshacer de un lote queda disponible tras recargar). Deshacer **parcial**: los precios alterados después no se tocan.
- Errores amables con **detalle técnico plegable** (`FriendlyError` acepta `detail` opcional); ante `P4096` la vista previa se regenera sola.
- Archivos nuevos: `src/lib/priceChange.ts`, `src/services/priceChange.service.ts`, `BulkPriceChangeDialog`, `PriceChangePreview`, `UndoPriceChangeDialog`, `RecentPriceChangesDialog`; `Modal` suma `size="xl"`.

**2B.1 — Nombres en "Cambios recientes" (migración `20261026140000_price_batches_product_names.sql`, aplicada 2026-10-26):**
- `list_recent_price_batches` mantiene todos sus campos y agrega `"productos"` (hasta 5 títulos de productos **distintos** tocados por el lote — base y variantes — resueltos desde `price_history`, ordenados por `product_id`) y `"productos_total"` (productos distintos tocados, para el "y N más"); si un producto fue borrado definitivamente su historial cae por cascade y no cuenta. Grants intactos (anon sin EXECUTE); las otras RPC sin cambios (md5 idénticos). **24 tests** en transacción con ROLLBACK; 50 lotes × 500 filas listados en **~14 ms**.
- Frontend: nombres bajo cada lote de "Cambios recientes" (componente `PriceBatchProducts`: máximo 2 renglones, nombres recortados a 40 caracteres, "y N más" siempre visible, títulos como **texto** sin HTML), también en la confirmación de Deshacer abierta **desde ese diálogo** (desde el aviso posterior se mantiene el texto genérico); tolerancia a lotes sin los campos nuevos (quedan `[]` y `0`); sin nombres no se muestra nada.
- **QA manual del dueño en producción de la 2B realizado y aprobado** (vista previa con variantes e inactiva, Deshacer desde el aviso y desde "Cambios recientes", casilla del modo exacto con variantes dispares); queda sin confirmar el caso de error real `P4096` (precio cambiado en otra pestaña) y, con él, el formato real del error de PostgREST.
- **Nota de uso:** una oferta queda excluida solo si el nuevo precio **iguala o supera** el precio anterior (o si el precio anterior supera 10 veces el nuevo); un aumento chico no la invalida.

**Pendientes nuevos:**
- Regenerar los tipos de Supabase (las 3 RPC se llaman sin tipar en el servicio).
- Confirmar en la prueba real el formato del error de PostgREST (`code`/`message`/`details` como string); el caso `P4096` real (precio cambiado en otra pestaña) sigue sin provocarse.
- Paginación de variantes de más de 1.000 filas por tanda no probada.
- Barra de selección a 320 px ocupa 3 renglones.
- Sin fechas de vigencia de ofertas (el modelo no las tiene; ver sección Ofertas).

**Camino de recuperación:** Deshacer desde el aviso final o desde "Cambios recientes"; respaldo local de la migración, volcados de tablas y `revert.sql` en `backup/2026-10-23-precios-masivos/` (ignorada por git).

## 📦 Cambio masivo de stock (Etapa 3) (2026-10)

### Backend (migración `20261026160000_bulk_stock_change.sql`, aplicada 2026-10-26)

- **Tabla `stock_change_batches`**: lotes con `created_by`, `meta` (auditoría: modo/valor/motivo), `rows_count`, `undo_of` (lote padre de un deshacer) y `undone_at`/`undone_by`. RLS activo con SELECT solo para admin; sin policies de escritura (la escritura es solo vía RPC).
- **`inventory_movements.batch_id`**: columna FK a la tabla de lotes + índice parcial `WHERE batch_id IS NOT NULL`.
- **3 RPC** (`SECURITY DEFINER`, `search_path = public, pg_temp`; EXECUTE solo `authenticated` y `service_role`; anon sin EXECUTE):
  - `apply_stock_change_bulk(p_items, p_meta)`: items `{inventory_id, expected_quantity, quantity}` con la cantidad **absoluta** resultante; meta `{modo: set|add|sub, valor, motivo 3..200 obligatorio}`; **todo o nada**, máximo **500 filas** por llamada (sin partir el lote); concurrencia optimista con `expected_quantity` y bloqueo ordenado por id (`FOR UPDATE ORDER BY id`, convive con `reserve_stock`/`confirm_sale`); `reserved` y `low_stock_threshold` **nunca se tocan**; `quantity < reserved` se rechaza (`quantity == reservado` permitido); las filas sin cambio se cuentan `unchanged` sin movimiento ni lote, y si todo el lote es unchanged la respuesta viene con `batch_id: null` (no se crea lote).
  - `undo_stock_change_bulk(p_batch_id)`: revierte **por DELTA INVERSO sobre el stock actual** (nunca stock absoluto, porque pudo haber ventas/reservas después); es **parcial**: las filas que quedarían `< 0` o `< reservado` van en `skipped` con su motivo; si no se restaura nada el lote original no se marca deshecho; crea un lote hijo con `undo_of` y `meta {modo: undo}`.
  - `list_recent_stock_batches(p_limit)`: últimos 10 lotes (máx. 50) para la UI, con `productos` (hasta 5 títulos de productos distintos tocados) y `productos_total` (para el "y N más").
- **Tipo de movimiento** (regla del trigger `trg_validate_movement_direction`, respetada): `restock` solo en modo `add` con increase; `adjustment` en los demás casos y en el deshacer (dirección inversa al delta original).
- **Tests**: 102 aserciones dentro de una transacción con ROLLBACK (fixtures descartables, cero escrituras reales); lote sintético de 500 filas en **~168 ms** (timeout del rol `authenticated` = 8 s); las 9 funciones existentes verificadas sin cambios.
- **Códigos de error** (PostgREST los expone como `code`, `message` y `details`): `P4003` no admin; `42501` anon sin EXECUTE; `P4094` lote inválido (vacío, >500 filas, meta >2 KB, modo inválido); `22023` stock o motivo inválido; `P4095` no existe / id duplicado; `P4043` en papelera; `P4096` stock cambiado (concurrencia optimista); `P4097` quedaría por debajo de lo reservado; `P4098` lote inexistente; `P4099` ya deshecho o es un deshacer. Con varios problemas el `code` es el de mayor prioridad (**P4095 > P4043 > P4096 > P4097**) y `details` trae `{"problems":[{"inventory_id","product_id","variant_id","motivo"}]}`.

### Frontend (Inventario)

- Selección múltiple: casillas por fila, Shift+clic para rangos, persistencia entre páginas, limpieza al cambiar búsqueda/estado/orden; **"Seleccionar las N filas (filtradas)"** leyendo todos los ids aunque el servidor corte (consultas de a 1.000 con conteo exacto).
- Botón **"Cambiar stock"** en la barra de selección; modos **Fijar / Sumar / Restar** con **motivo obligatorio**.
- **Exclusión por fila** (cada fila de inventario se evalúa sola): quedar por debajo de lo reservado, no alcanzar el stock, superar el máximo (1.000.000) o no estar disponible (producto en papelera o eliminado).
- Marca **"Quedará agotado"** con aviso y conteo de filas (no bloquea el envío; afecta la disponibilidad en la tienda y el marcado schema.org InStock/OutOfStock).
- Se envían **solo las filas con cambio**; tope de 500 filas **bloqueado en la UI** (el lote nunca se parte); aplicación con modal **no descartable**; aviso final con botón **Deshacer**; diálogo **"Cambios recientes"** (últimos 10 lotes, con motivo y nombres de productos; el Deshacer de un lote queda disponible tras recargar).
- Errores amables con **detalle técnico plegable** (`StockChangeError`); ante `P4096` (por ejemplo una venta en el medio) la vista previa **se regenera sola**; `clearAvailabilityCache()` una vez por operación exitosa; el ajuste individual de stock **no se tocó**.
- Archivos nuevos: `src/lib/stockChange.ts`, `src/services/stockChange.service.ts`, `BulkStockChangeDialog`, `StockChangePreview`, `UndoStockChangeDialog`, `RecentStockChangesDialog` (en `src/components/admin/inventory/`).

**Pendientes nuevos:**
- `getAllAdmin` (la lista de Inventario) trae todas las filas sin paginar en el servidor: con más de 1.000 filas PostgREST corta la lista (hoy 241); hacer la paginación del lado servidor antes de llegar a ~800 filas.
- El filtro "stock bajo" del frontend está hardcodeado a 5 y ignora `low_stock_threshold`.
- Stock "huérfano" en la fila base de productos con variantes sin opción base (posible limpieza masiva aparte).
- Prueba manual del dueño en producción con productos descartables ("PRUEBA") para fijar/sumar/restar, Deshacer y Cambios recientes.
- Confirmar en esa prueba el formato real de los errores de PostgREST (junto con el caso `P4096` de precios).

**Camino de recuperación:** Deshacer desde el aviso final o desde "Cambios recientes"; respaldo local en `backup/2026-10-26-stock-masivo/` (ignorada por git, con volcados de tablas y `revert.sql`).

---

## 🔎 SEO fase 2 (2026-10)

### Auditoría SEO (hallazgos CRÍTICO/ALTO)

- El HTML crudo que reciben los buscadores es el mismo shell para todas las rutas: sin title, description, canonical ni JSON-LD por ruta (todo lo pone `Seo.tsx` recién al ejecutar JS).
- `og:url` y `og:image` genéricos en el HTML crudo (los previews al compartir una ficha muestran la portada del sitio).
- Soft 404: slugs inexistentes o inactivos y rutas fuera del router responden 200 con el shell.
- No había sitemap (`/sitemap.xml` devolvía el shell con 200) y `robots.txt` no declaraba `Sitemap`.
- LCP alto en `/categoria/:slug`.
- Los assets hasheados de `/assets` no tienen cache largo (`immutable`).
- La home no tiene `h1`.
- JSON-LD incompleto (Offer sin `priceValidUntil`/`shippingDetails`/`hasMerchantReturnPolicy`, sin `ItemList`/`FAQPage`/`BreadcrumbList`).

### Tanda 1 (hecha): sitemap dinámico + `Sitemap` en robots.txt

- **`api/sitemap.ts`** (Vercel Function, handler `export default { fetch(request) }`): lee Supabase por PostgREST **solo con la clave anon** (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de Vercel, que hoy solo está en Production) y **solo lecturas**, paginando de a 1.000 con `Range` y exigiendo que lo traído coincida con el total de `Content-Range`.
- `vercel.json`: rewrite `/sitemap.xml` → `/api/sitemap` **antes** del catch-all a `/index.html` (el catch-all quedó igual).
- **Incluye** (dominio canónico `https://www.iguazumarketplace.com.ar`, sin barra final salvo la home): las 12 páginas indexables del router (`/`, `/categoria`, `/ofertas`, `/contacto`, `/preguntas-frecuentes`, `/nosotros`, `/envios`, `/medios-de-pago`, `/privacidad`, `/terminos`, `/devoluciones`, `/arrepentimiento`); cada `/producto/:slug` activo y no eliminado (`activo = true`, `deleted_at IS NULL`); cada `/categoria/:slug` **elegible**, con la misma lógica que la página: categoría activa cuyo subárbol de categorías activas (cualquier profundidad) contiene al menos un producto activo con stock disponible según `get_product_availability` (la grilla solo muestra esos).
- **Excluye** todo lo `noindex` o con `Disallow` (admin, checkout, carrito, perfil, pedidos, pedido, pago, login, register, reset-password, report, búsqueda), `/categoria/:slug` sin productos visibles y rutas con parámetros.
- `<lastmod>` (YYYY-MM-DD) solo en productos, desde `updated_at`; sin `priority` ni `changefreq`. XML con escapado de entidades, slugs con `encodeURIComponent`, sin duplicados y orden determinista (estáticas, categorías y productos por URL).
- **Cache:** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` (CDN de Vercel, 1 h). **Ante falla** (Supabase con error, datos incompletos, 0 productos o falta de configuración) responde **503** con `Retry-After` y `Cache-Control: no-store`: nunca se cachea un sitemap vacío ni parcial.
- **Límite:** con más de **45.000 URLs** responde 503 en vez de un XML inválido; al acercarse a ese número hay que pasar a un **sitemap index** (varios sitemaps).
- `public/robots.txt`: se agregó `Sitemap: https://www.iguazumarketplace.com.ar/sitemap.xml` (User-agent, Allow y los 12 Disallow sin cambios).

### Tanda 2 (hecha): metadatos reales, 404 y 301 en `/producto/:slug`

- **`api/producto.ts`** (Vercel Function, `export default { fetch }`) + rewrite `/producto/:slug` → `/api/producto?slug=:slug` en `vercel.json`, antes del catch-all (sitemap y catch-all sin cambios). Sirve el `index.html` del mismo deployment (pedido a `/index.html` y cacheado en la instancia) con el `<head>` del producto ya armado, para **todos** los visitantes (sin lista de user-agents). La SPA arranca igual por encima.
- **Qué inyecta** (reemplazando, sin duplicar, las etiquetas del shell): `<title>` con el patrón de `Seo.tsx` (`<título> | Iguazú Marketplace`); meta description con la regla de `ProductPage` (espacios colapsados, 155 caracteres con `...`, fallback "`<título> en <categoría>. Comprá con envío gratis a todo el país.`"); `link rel="canonical"` y `og:url` = `https://www.iguazumarketplace.com.ar/producto/<slug>`; `og:title`, `og:description`, `og:type=product`, `og:image` (la misma imagen que elige `ProductPage`: galería propia con la principal primero, `imagen_url` o la principal de la primera variante activa; sin imagen, `/og-default.png`) y `twitter:title/description/image`. Solo etiquetas que `Seo.tsx` administra y limpia al navegar dentro de la SPA (una sola consulta a Supabase). Conserva `og:site_name`, `og:locale` y `twitter:card`. Todo escapado.
- **Respuestas:** 200 con `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`; **404 solo con confirmación de la base** (slug inexistente, inactivo o en papelera; también slugs con caracteres fuera de `[A-Za-z0-9-]` o de más de 200, sin consultar), con el shell + `<meta name="robots" content="noindex">` y `s-maxage=60`; **301** del id numérico al slug (`s-maxage=3600`) solo si no existe un producto con ese slug exacto (138 de 161 slugs son numéricos, por eso primero se busca el slug); 405 para métodos distintos de GET/HEAD.
- **Fallback seguro:** ante cualquier error (Supabase caído o con error, respuesta inesperada, timeout de 2,5 s con plazo duro) sirve el **shell sin modificar con 200 y `no-store`**. Solo si no hay ninguna plantilla posible (falla `/index.html` y no hay copia en memoria) responde 503 `no-store`.
- Lecturas solo con la clave anon (las mismas variables que el sitemap) y sin importar nada de `src/`: las reglas están duplicadas en `api/producto.ts` con el archivo de origen comentado. **Si cambian `Seo.tsx`, `ProductPage` (descripción, imagen o preselección) o `productImages.service.ts`, hay que actualizar también `api/producto.ts`.**
- **Fuera a propósito:** JSON-LD (lo sigue emitiendo la SPA; va en la Tanda 5 con un generador compartido), `og:image:alt` y `product:price:amount`/`product:price:currency`/`product:availability` (`Seo.tsx` no las administra: inyectadas por el servidor quedarían pegadas con los valores de la primera ficha al navegar dentro de la SPA; vuelven en la Tanda 5), `/categoria/:slug` y las rutas genéricas.

**Medición de imágenes** (muestra de 15 imágenes principales, solo lectura): 157 de 161 productos tienen imagen, todas en Supabase Storage; 10 JPEG y 5 WebP; tamaño mínimo 21 KB, mediana 57 KB, máximo 423 KB (1 por encima de 300 KB, ninguna por encima de 600 KB); casi todas cuadradas (640 a 1.200 px de lado). El endpoint de transformación de Supabase (`render/image`) **no está habilitado** en el plan actual (403 `FeatureNotEnabled`). **Decisión pendiente:** generar una imagen social de 1200×630 por producto (las cuadradas se recortan en `summary_large_image`), ya sea habilitando la transformación en Supabase o con otra vía; por peso no hace falta hoy.

### Tanda 2B (hecha): metadatos reales y 404 en `/categoria/:slug` + redirección de la barra final

- **`api/categoria.ts`** (mismo patrón que `api/producto.ts`) + rewrite `/categoria/:slug` → `/api/categoria?slug=:slug` antes del catch-all. Una sola consulta (categoría activa por slug, anon, timeout de 2,5 s con plazo duro). Inyecta, sin duplicar: `<title>` `<nombre> | Iguazú Marketplace`, description `Comprá <nombre> con envío gratis a todo el país.` (la misma de `CategoryPage`), canonical y `og:url` = `https://www.iguazumarketplace.com.ar/categoria/<slug>`, `og:title`, `og:description`, `og:type=website` (el default de `Seo.tsx`, que es lo que usa la página), `og:image` y `twitter:image` genéricas (`/og-default.png`: la tabla `categories` no tiene descripción ni imagen) y `twitter:title/description`. Sin `og:image:alt` ni `product:*`.
- **Respuestas:** 200 con `s-maxage=300, stale-while-revalidate=3600` para toda categoría activa, **tenga o no productos visibles** (la página existe); **404 solo con confirmación de la base** (inexistente o inactiva, que la RLS pública no deja ver) o slug inválido sin consultar, con shell + `noindex` y `s-maxage=60`; ante cualquier error, shell sin modificar, 200 y `no-store`; 503 solo sin plantilla.
- **Sin helper compartido (decisión):** el código común (plantilla, escape, reemplazo de etiquetas, respuestas) está **duplicado** en `api/categoria.ts` con el origen comentado. Un import entre funciones (`api/_lib/`) con `"type": "module"` depende de cómo el runtime de Vercel resuelve extensiones en ESM y no se podía probar antes del deploy (la vista previa está protegida y sin la clave anon); `api/producto.ts` quedó intacto. Unificar en una tanda futura que se pueda verificar en una vista previa.
- **`"trailingSlash": false`** en `vercel.json`: cualquier ruta que termina en `/` responde 308 a la misma ruta sin la barra (documentación de Vercel: "`/about/` will redirect to `/about`"). Corrige que `/producto/<slug>/` y `/categoria/<slug>/` caían en el catch-all con el shell genérico, y evita contenido duplicado con y sin barra.

### Tanda 4: diagnóstico de rendimiento (2026-10-27, solo medición)

Lighthouse 12.8.2 en laboratorio (3 corridas, mediana, móvil con throttling simulado), desde una sola máquina en Argentina; sin datos de campo.

| Página | Score móvil | LCP móvil | Peso |
|---|---|---|---|
| Home | 77 | 4,5 s (el `h1`, con fade-in) | 4,4 MB |
| Categoría (2 medidas) | 70 y 69 | **12,9 y 13,6 s** | 2,4–2,7 MB |
| Ficha (con variantes / simple) | 71 y 65 | 5,7 y 9,4 s | 2,3–2,4 MB |
| `/ofertas` | 74 | 5,0 s | **12,4 MB** |

CLS (≤ 0,036) y TBT (≤ 15 ms) están bien en todas. La "navegación interna de ~9 s" **no se reprodujo**: medida en Chrome real da 0,7–0,9 s; los 9 s eran esperas fijas de una verificación anterior.

**Causas, por impacto:**

1. **Íconos de categoría** (`src/assets/images/icons/*.png`): 13 PNG de 1254×1254 px que suman **11,1 MB** y se muestran a 56 px o menos. Se cargan 4 en la Home, 2 por categoría y los 13 en `/ofertas`; en la categoría bajan con prioridad alta antes que la foto LCP.
2. **Consultas a Supabase en serie**, cada una con su preflight CORS: la ficha hace 6 seguidas antes de pedir las imágenes y la categoría hace 4 rondas.
3. **Foto LCP de la categoría** con `loading="lazy"` y de 1000–1500 px para mostrarse a 239 px.
4. **Imagen principal de la ficha sin prioridad** (Lighthouse estima 1–3,2 s), compitiendo con los relacionados (hasta 731 KB).
5. **Assets sin cache largo:** `/assets/*` con hash salían con `max-age=0, must-revalidate`, así que cada visita repetida los revalidaba.
6. **Regiones desalineadas:** las funciones corrían en `iad1` (Washington) y Supabase está en `sa-east-1` (São Paulo, inferido por latencia). TTFB de una ficha en MISS: 0,75–0,78 s, contra 0,19–0,22 s con HIT.
7. **Logo** `iguazu1.png` de 187 KB mostrado a 153×65 px.
8. **Fuentes TTF** sin woff2 (`MarkPro.ttf`, 85 KB comprimido, sin preload).
9. **framer-motion** en el chunk de arranque (`index`, 189 KB gzip; unos 55 % sin usar en la primera pantalla).

### Tanda 4A (hecha): cache `immutable` para `/assets` y funciones en `gru1`

- **`vercel.json`:** `headers` con `Cache-Control: public, max-age=31536000, immutable` para `/assets/(.*)`. En el build todos los archivos de `dist/assets/` llevan hash en el nombre; los que no tienen hash (`og-default.png`, favicons, `robots.txt`, `index.html`) están fuera de `/assets/` y no cambian.
- **`vercel.json`:** `"regions": ["gru1"]` para que las funciones (`api/sitemap`, `api/producto`, `api/categoria`) corran en São Paulo, junto al borde y a Supabase. Hobby admite una sola región; con más regiones de las permitidas, el deploy falla.
- **Línea base antes del cambio:** JS, CSS, TTF, HTML y `og-default.png` con `public, max-age=0, must-revalidate`. Cinco MISS a una ficha: mediana 709 ms, rango 391–2.640 ms, todos en `gru1::iad1`.
- **Resultado medido en producción tras el deploy (commit `bd7df04`):**
  - JS, CSS y TTF de `/assets` salen con `public, max-age=31536000, immutable` y brotli. HTML, `og-default.png` y `robots.txt` siguen con `max-age=0, must-revalidate`.
  - Las funciones (ficha, categoría y sitemap) corren en `gru1::gru1`.
  - Cinco MISS a la misma ficha: mediana **152 ms**, rango 134–330 ms (antes 709 ms; 391–2.640 ms).
  - En Chrome, al volver a cargar la Home y la ficha, los 22 assets salen de la caché del navegador sin pedirse a la red.
  - Rutas, metadatos, 404, 301 y redirecciones sin cambios.
- **Observación:** un archivo inexistente bajo `/assets/` cae en el catch-all y responde **200 con el shell** (igual que antes), pero ahora con la cabecera `immutable`. Es de impacto bajo, porque los nombres llevan hash y un nombre viejo no vuelve a ser válido. Para que respondan un 404 real habría que excluir `/assets/` del catch-all (queda para la Tanda 3).

### Plan de las siguientes tandas (en este orden)

**Rendimiento** (las tandas 4B a 4G):

| Tanda | Qué cambia |
|---|---|
| **4B** | Íconos de categoría y logo a WebP (íconos a ~128 px); fuentes a woff2 con preload de `MarkPro`; preconnect a Supabase con `%VITE_SUPABASE_URL%` en `index.html`, sin escribir la URL en el repo. |
| **4C** | Prioridad de imágenes: `eager` y `fetchpriority="high"` en la primera fila de la grilla y en la imagen principal de la ficha; `lazy` en relacionados y miniaturas; `width`/`height`; sin animación de entrada en el `h1` de la Home ni en la galería. |
| **4D** | Paralelizar consultas: `Promise.all` en `ProductPage`; quitar el `getByProductId` repetido; una sola consulta de categorías, cacheada; favoritos en lote; columnas de tarjeta en `STORE_SELECT`; borrar `getActiveProducts`, que no se usa. |
| **4E** | `LazyMotion` / reducir framer-motion en el arranque. |
| **4F** | Vista o RPC "catálogo disponible" con las columnas de tarjeta (migración), para eliminar la ronda de disponibilidad y la lista de ~170 ids en la URL. |
| **4G** | Redimensionar las fotos de producto al subirlas en el admin, más un script de migración de las ~996 fotos existentes. Requiere aprobación del dueño y respaldo. La transformación de imágenes de Supabase no está habilitada en el plan. |

**Pendientes de SEO:**

1. **Tanda 3:** 404 reales para las rutas fuera del router; canonical y `og:url` correctos en el HTML de las páginas estáticas (`/`, `/categoria`, `/ofertas`, `/contacto`, legales, etc.); `X-Robots-Tag` para las rutas privadas.
2. **Tanda 5:** JSON-LD con un generador compartido (`Product` con `AggregateOffer` para variantes, `BreadcrumbList`, `ItemList`, `FAQPage`, `priceValidUntil`/`shippingDetails`/`hasMerchantReturnPolicy`, sin inventar ratings), `og:image:alt` y `product:*` + limpieza en `Seo.tsx`, y `h1` en la home. **Pendiente para esta tanda:** volver a agregar en `api/producto.ts` `og:image:alt` y `product:price:amount`/`product:price:currency`/`product:availability` (precio de la preselección del cliente de `ProductPage`: opción base con stock → precio del producto, si no la primera variante activa con stock; disponibilidad de `get_product_availability`; hay que reimplementarlas, no quedaron commiteadas), junto con el cambio de `Seo.tsx` para que limpie las etiquetas inyectadas por el servidor al navegar dentro de la SPA, y el generador compartido de JSON-LD.
3. **Slugs descriptivos** con 301 desde los slugs viejos (ver abajo).

**Pendiente nuevo (sin implementar): slugs descriptivos.** 138 de 161 productos tienen un slug de solo dígitos (URLs tipo `/producto/<número>`), que no aportan palabras clave y se confunden con el id. Proponer más adelante una tanda de "slugs descriptivos" (generados desde el título con la regla del admin) con **redirección 301 desde los slugs viejos**, idealmente antes de que haya enlaces indexados (Search Console recién por dar de alta).

**Decisión:** por ahora **no** se migra a SSR ni a un framework; se sigue con la SPA + funciones de Vercel puntuales.

**Pendiente del dueño:** dar de alta Google Search Console (propiedad de dominio) y enviar el sitemap.

**Método de trabajo:** desde 2026-10-26 las tandas de backend las ejecuta **Claude Code (backend)**, porque se agotó la cuota gratuita de opencode.

---

## 🧪 Convenciones de QA del admin (2026-10)

Regla para probar cualquier pantalla del admin (además de lo habitual de revisar desbordes horizontales):

- Verificar que `document.documentElement.scrollHeight == window.innerHeight` (el scroll de las pantallas del admin ocurre **solo** dentro de `<main data-scroll-container>`; si el documento crece, algo se está posicionando respecto del `body`).
- Todo elemento con `sr-only` o con `position: absolute` dentro del admin debe tener un ancestro `relative` **dentro del área que scrollea** (si no, se posiciona respecto del `body` y estira el documento — caso del hotfix de `ProductTable.tsx`).

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
- `npx tsc -b` tiene 49 errores preexistentes (verificado 2026-10-22; el build de Vite compila bien); lint en 66 problemas (57 errores, 9 warnings) como línea base.
- `sort_order=0` cosmético en galerías; la galería se comparte entre variantes de distinta capacidad.
- Chunk de build >500 kB, sin script `typecheck`, sin tests, `tailwind.config.js` duplicado.
- ~~SEO pendiente (Fase 12): `lang="en"` en `index.html`, sin meta description/OG, sin `robots.txt`~~ — **fase 1 hecha** (2026-10-08): queda `sitemap.xml` y el resto de la fase 2.
- ~~Hardcodeos vigentes (verificado 2026-10-05): SKU inventado en la ficha de producto — `ProductPage.tsx` (~línea 587) arma un SKU desde el slug y usa `'DEMO-SKU-001'` como último recurso (la tabla `products` no tiene campo SKU): corregir antes del lanzamiento~~ — **resuelto** (2026-10-08): la ficha muestra el SKU solo si es real (de variante). Queda: link a portfolio personal en `Footer.tsx`.
- `create-quote`: **dada de baja en producción** (2026-10-14): la función no la invoca ninguna pantalla (`fetchShippingQuote` no se usa), no tiene rate limit y cada llamada consume 3 requests de la API de Correo Argentino; el código queda versionado en `supabase/functions/create-quote/`. Solo reconectarla (con redeploy) si se define un uso real, y en ese caso agregar rate limit y cache del token de Correo Argentino.
- ~~Fixtures QA (productos 1007/1008): el inventario 31 (producto 1008) tiene movimientos de fixtures del 16/09 y un ajuste manual sin referencia, así que muestra una discrepancia contra el libro de movimientos; se resuelve al borrar/ocultar los productos QA antes del lanzamiento~~ — **resuelto** (2026-10-08): productos, inventarios y movimientos QA eliminados.
- ~~QA de punta a punta de la transferencia con la cuenta QA **después** del deploy del frontend~~ — **hecho** (ver "Hechos confirmados por QA manual", 2026-10-07, transferencia punta a punta en producción).
- ~~Limpieza de los datos del QA manual de transferencia (pedidos de prueba y ajuste de stock): a resolver por el dueño.~~ — **resuelto** (2026-10-08): todos los pedidos de prueba (incluidos los del QA manual) borrados y stock verificado.
- Pendientes de datos (a cargo del dueño, no bloqueantes): editar las variantes `TEST-256`/`TEST-512` del producto 8 y los productos inactivos viejos 7, 9, 10, 11, 12 y 14. Las tablas `_legacy_*` y `reportes_errores` se conservan (decisión: no se borran).
- Warning de React preexistente en `src/pages/checkout/CheckoutStepEnvio.tsx:165` (`onComplete` llamado durante el render).
- `index.html` ~~sigue con `lang="en"`~~ — **resuelto** (2026-10-08): ahora es `lang="es"` con metadatos por defecto (SEO fase 1).
- `PaymentOrderSummary` tiene `max-w-md` fijo, anulado desde el wrapper.
- Desborde estético de ~10 px de una palabra en el selector de medios de pago a 1024 px.
- Mejora futura: botón "Cancelar este pedido" en las páginas de pago para que el cliente libere un pedido manual pendiente (hoy un cliente con un pago manual pendiente no puede iniciar otra compra hasta que se pague o se cancele, hasta 25 h).
- El admin muestra los montos redondeados a pesos (sin decimales).
- `src/pages/checkout/CheckoutContext.tsx:75`: el comentario dice "ambos métodos" y ya son tres.
- `PaymentUsdtPage` promete confirmar el pago por WhatsApp o email; la confirmación real llega por email (o a mano desde el admin).
- Automatizar la reposición de stock al cancelar pedidos con pago aprobado (hoy es manual, con aviso en el admin).
- SEO fase 2: ~~`sitemap.xml` dinámico~~ (Tanda 1), ~~vista previa Open Graph por producto + 404/301 en fichas~~ (Tanda 2), ~~categorías + barra final~~ (Tanda 2B) y ~~cache immutable de /assets + funciones en gru1~~ (Tanda 4A) hechos; quedan el soft 404 del resto de las rutas, el resto de rendimiento (4B-4G) y JSON-LD (ver "SEO fase 2").
- `public/og-default.png` es provisoria: reemplazar por una imagen diseñada.
- ~~`ProductPage.tsx` muestra un SKU inventado (armado desde el slug, con `'DEMO-SKU-001'` de último recurso)~~ — **resuelto** (2026-10-08): ver "Hardcodeos vigentes" (SKU solo si es real).
- `ProtectedRoute` muestra su pantalla de carga sin `Seo` mientras resuelve la sesión (sin impacto: redirige a `/login`, que tiene `noindex`).
- `public/favicon.svg` y `public/icons.svg` son restos de la plantilla de Vite sin uso: revisar y borrar luego.
- **Verificación previa al lanzamiento (periódica):** revisar que ningún texto de la tienda prometa más que los Términos (garantía, envío, plazos, medios de pago).
- El comentario de `LINK_ARREPENTIMIENTO` en `src/config/legal.ts` dice que la página no existe, pero `/arrepentimiento` ya existe: actualizar el comentario.
- Pendiente del dueño (edición desde el admin): corregir los nombres de categorías sin tilde (Perifericos, Fuentes de Alimentacion, Microfonos, Camaras, Consolas portatiles); el slug no cambia al editar.
- Decidir si se crean las categorías Hardware y Audio como raíz (estructura) en vez de usar Procesadores y Auriculares en el footer; revisar antes el impacto en el menú de categorías y en la home.
- Evaluar si el footer en mobile (crece unos 280 px por las áreas táctiles) conviene pasarlo a dos columnas.
- Probar el flujo de login/admin en uso real con Supabase (la verificación de los cambios de auth fue con mocks).
- **`reply_to` de los emails de pedidos:** hoy ningún email define `reply_to`; conviene poner la casilla del dueño vía un secret (no en el repo) para que las respuestas del cliente lleguen al dueño y no al remitente genérico.
- **Los toasts (Sileo) no se apilan:** el segundo reemplaza al primero; si hace falta ver los dos, implementar pila. **Legado del aviso de "Deshacer" del carrito:** el botón mide 27 px en mobile (limitación del dibujo de Sileo).
- Pendientes del "Deshacer" del carrito: el `removeItem` del carrito de **invitado** borra por `product_id` (todas las líneas del producto) — bug previo, hoy oculto porque `/carrito` no dibuja el carrito de invitado; el mensaje "ya no está disponible" es impreciso si falla la lectura de stock; reactivar el aviso desde Mi cuenta (borrando la clave de `localStorage`) es una mejora futura; QA manual del flujo en producción.
  - ~~bug removeItem de invitado por product_id~~ — **resuelto (2026-10-14)**: ahora opera sobre la línea exacta (producto + variante|base).
- Pendientes del carrito de invitado: botones de cantidad/papelera del carrito a 32 px y "Continuar" a 40 px en mobile (compartido con el carrito logueado; tanda aparte para llevar todos a **44 px en mobile**); probar en el sitio real la carrera sesión/navegación tras login (Supabase emite el evento de sesión antes de resolver `signInWithPassword`); si falla una RPC de disponibilidad la línea se ve sin stock en vez de mostrar error de red; producto con todas las variantes inactivas queda sin stock para el invitado (mismo criterio que las listas).
- **Toast con modal abierto:** queda detrás del fondo del diálogo (z-index); revisar los errores que se muestran en diálogos del admin.
- **Verificar el ojo de contraseña y las notificaciones en pantallas con sesión** (perfil, admin, checkout) y en **Edge** (el CSS de los toasts no fue probado ahí).
- **~~ANÁLISIS PENDIENTE — disponibilidad con variantes:~~** ~~productos con variantes cuyo producto base tiene stock propio **no se muestran en la tienda si las variantes no tienen stock** (afecta también a los destacados); auditar la lógica de disponibilidad con variantes antes de decidir el modelo de stock.~~ — **resuelto (2026-10-14)**: modelo de **opción base elegible** (ver sección propia); el stock propio del producto cuenta solo si el dueño habilita la opción con un nombre.

---

## ✅ Próximos pasos (orden recomendado)

1. **Cards de producto unificadas** con imagen cuadrada entera (en curso)
2. **Rediseño del menú mobile** (drawer) (en curso)
3. **Página de Contacto** y textos del footer que no son links
4. **SEO básico** (Fase 12): `lang="es"`, meta description/OG, `robots.txt` y `sitemap.xml`
5. **Bloqueantes de lanzamiento**: condición fiscal en `src/config/legal.ts` (antes del 1 de noviembre de 2026), rotar `MP_WEBHOOK_SECRET`, primer pago USDT real, dominio propio + Resend + `RESEND_FROM_EMAIL` + CORS de `request-withdrawal` (o `SITE_URL`)

---

## 🗂️ Historial de sesiones

- **2026-10-14 (carrito de invitado visible + retorno seguro tras login)** — `/carrito` muestra el carrito de invitado desde `iguazu_cart` (lectura saneada: JSON roto ⇒ vacío, líneas inválidas descartadas, cantidad 1-999, máximo 30 líneas, duplicados unidos), enriquecido con 1 consulta de productos (embeds de fotos y variantes) + RPC públicas de disponibilidad (peor caso 31 llamadas con 30 líneas); misma UI que el carrito logueado (rótulos, fotos por variante, modal de quitar + Deshacer); precio vigente con aviso "El precio cambió"; líneas no disponibles bloquean "Continuar"; fix de `removeItem`/`updateQuantity` por línea exacta (antes borraba por `product_id`); "Continuar" de invitado → `/login?redirect=/checkout` con retorno interno seguro (`safeInternalPath`) y `ProtectedRoute` agregando `?redirect=` en todas las rutas protegidas. **Gate REST anon verificado contra la BD real:** las 3 RPC (`get_product_availability`, `get_variant_availability`, `get_product_base_availability`) son **STABLE con 0 sentencias de escritura**; consulta de productos por ids HTTP 200 con embeds completos (fotos con su variante y variantes activas); RPCs en HTTP 200 (52 filas, 1 fila y 1 fila — la opción base de 1053 ya está configurada, con stock base 8); productos inactivos (7, 9-14) **no visibles** para anon y variantes inactivas **no embebidas** (1019: 6 de 9; 1049: 2 de 3). Verificado contra la línea base: `tsc -b` **50**, lint **66 (57 errores, 9 warnings)**, build OK.

- **2026-10-14 (carrito: confirmación al quitar + Deshacer)** — Modal de confirmación al quitar una línea del carrito (foto, título, rótulo y cantidad) con casilla "No mostrar este mensaje otra vez" (por dispositivo, solo al confirmar tildada); aviso Sileo con "Deshacer" (7 s) que restaura la línea exacta por el camino normal de `addToCart` respetando stock (sin stock avisa, parcial restaura lo posible), buffer de hasta 5 eliminaciones válidas 10 s con encadenamiento, descartado al salir del carrito; "-" con cantidad 1 pasa por el mismo flujo. Punto de entrada único `useRemoveCartItem` + `CartRemovalProvider`; `removeItem` devuelve `Promise<boolean>`. Verificación de `cartService.getLineStock` (lectura de stock del Deshacer): SQL confirma **1 sola FK** de `inventory` hacia `products` y **1 sola** hacia `product_variants` (sin ambigüedad para PostgREST); la consulta REST con embeds es **no verificable sin login** (RLS devuelve vacío para anon). Verificado contra la línea base: `tsc -b` **50**, lint **66 (57 errores, 9 warnings)**, build OK.

- **2026-10-14 (carrito: rótulos/fotos de la opción base + portada de la galería propia)** — El carrito y el checkout rotulan la opción base con el atributo común de las variantes cuando es unívoco, muestran la foto propia de cada variante (fallback heredado) y agrupan las líneas del mismo producto (base primero; solo presentación). Las portadas de tarjetas/listas/SEO salen solo de la galería propia del producto, con fallback a `imagen_url` y a la principal de la primera variante activa (corrige portadas que podían ser la foto de una variante). Gate REST verificado contra la BD real con el embed anidado `product_images(..., product_variants(activo, sort_order))`: listas, ficha y ofertas en HTTP 200, conteos iguales a la consulta vieja; el campo anidado llega para las fotos de variantes activas y `null` para las de variantes inactivas (comportamiento esperado por RLS, el código lo maneja). Verificado contra la línea base: `tsc -b` **50**, lint **66 (57 errores, 9 warnings)**, build OK.

- **2026-10-14 (opción base elegible: BD + servidor + frontend)** — Feature completa opt-in para productos con variantes: columna `products.opcion_base_nombre`, `get_product_availability` suma el stock base cuando hay nombre, RPC `get_product_base_availability`, `p_opcion_base_nombre` en las RPCs de admin, regla de servidor `INVALID_VARIANT` y frontend (campo en admin, opción base primera en el selector de la ficha, línea aparte en el carrito, rótulo en Inventario, selector a 44 px). Migración `20261014100000_product_base_option.sql` aplicada en producción (ensayo previo en transacción con ROLLBACK y verificación byte a byte contra respaldos en `backup/`); `create-payment`, `create-payment-usdt` y `create-payment-transfer` redeplegadas (v42/v26/v10) con preflight OPTIONS y CORS verificados. Tests con mocks de `order-creation` 5/5 (`node supabase/functions/_shared/order-creation.test.ts`); `deno check` OK. Verificado contra la línea base: `tsc -b` **50**, lint **66 (57 errores, 9 warnings)**, build OK.

- **2026-10-14 (frontend: notificaciones, ojo de contraseña, avisos de reset) + cierre de la migración de dominio** — **Notificaciones (Sileo)** ahora aparecen **abajo a la derecha** y **siempre oscuras** (relleno fijo del color `primary-dark`, independiente del tema claro/oscuro del admin). **Botón ver/ocultar contraseña:** componente nuevo `PasswordInput` (prop `revealable` en `Input`) en login, registro, reset, perfil y admin. **Avisos de `ResetPasswordPage` corregidos:** Sileo exige un objeto de opciones, no texto suelto (el resto de las llamadas ya estaba bien). Migración de dominio cerrada: secret `SITE_URL`, CORS de las 6 Edge Functions, Auth de Supabase y SMTP propio (Resend) configurados, `RESEND_FROM_EMAIL` con el remitente del dominio propio, y `create-quote` dada de baja en producción (código en el repo). Verificado contra la línea base: `tsc -b` **50**, lint **66 (57 errores, 9 warnings)**, build OK.

- **2026-10-09 (pulido de frontend)** — **Navbar, pantallas de carga, auth, scroll y footer:** el Navbar pasó a **altura fija** con el logo siempre en tamaño grande (se eliminó el efecto de achicarse al scrollear, que causaba un **titileo por bucle de scroll**; ahora solo cambia la sombra al scrollear). Pantallas de carga **unificadas en un componente `LoadingScreen`** (con variante de error), con soporte de tema oscuro/claro en admin y `reduced-motion`; el fallback del `Suspense` espera **250 ms**. **`AuthProvider`:** loading derivado (no puede quedar colgado), timeouts de **10 s** en sesión y perfil, sin parpadeo de "Error al cargar el perfil" después del login — **validado con mocks; falta probarlo con Supabase real en uso normal** (anotado como pendiente). **`ScrollManager`:** cada navegación nueva abre arriba; atrás/adelante restauran la posición; el cambio de página de resultados en búsqueda/categoría sube; contenedores con scroll propio (admin, login/registro) marcados con `data-scroll-container`. **Footer:** links de "Comprar" apuntan a categorías **reales** (Smartphones, Procesadores, Auriculares, Monitores, Perifericos) más "Todos los productos"; link unificado "Garantías, cambios y devoluciones"; ortografía corregida; áreas táctiles de al menos **44 px en mobile y 24 px desde lg**. Causa del bug previo del link por categoría: se usaba el parámetro `category` pero la búsqueda lee `cat`. Verificado contra la línea base: `tsc -b` **52**, lint **66 (57 errores, 9 warnings)**, build OK.

- **2026-10-08 (cierre QA)** — **Limpieza de datos QA completada en producción** (en 2 fases: inventario solo lectivo y ejecución con backup, transacción con verificación): pedidos/pagos/envíos a **0**, secuencia de pedidos reiniciada (próximo **`PED-00001`**), productos QA 1007/1008 y sus 12 movimientos eliminados (quantity total 369 → 363), cuentas de prueba borradas (queda solo la cuenta admin con sus 2 direcciones, carrito y favorito), avatares ajenos borrados (queda 1) y función `qa_reset_admin_order` eliminada por la migración nueva `20261008090000_drop_qa_functions.sql` (0 funciones `qa_*`). Stock real confirmado por el dueño: **1009 = 8, 1037 = 4 (sin ajuste)**. Migraciones `qa_*` permanecen en el historial: **no ejecutar en bases nuevas** (contienen contraseñas y emails de prueba como literales; chequeo read-only hecho sin exponer valores). Backup completo en `backup/` (ignorado por git). `PROJECT_STATUS.md` actualizado (bloqueador 4, fixtures QA y limpieza de transferencia resueltos; nuevo pendiente de datos del dueño; sin duplicar pendientes de lanzamiento ya listados). Sin cambios de código en esta tarea (solo este archivo y la migración nueva) — la línea base sin tocar (`tsc -b` 52, lint 67).

- **2026-10-08 (noche)** — **Datos legales del proveedor commiteados:** identificación del proveedor cargada en `src/config/legal.ts` (solo las claves de nombre, CUIT, domicilio, fecha de publicación 1 de noviembre de 2026 y analíticas), visible únicamente en Términos 1.1 y Privacidad 2.1; condición fiscal sigue pendiente como **bloqueador de lanzamiento** (inscripción en ARCA, antes del 1 de noviembre). Chequeo de seguridad del repo antes del commit: `backup/` ignorado y ausente del historial completo, sin archivos sensibles trackeados, solo rama `main` y sin tags. `PROJECT_STATUS.md` actualizado (bloqueador 1 acotado a la condición fiscal, comentario de `LINK_ARREPENTIMIENTO` anotado). Verificado contra la línea base (`tsc -b` 52, lint 67, build OK) y escaneo de secretos sin matches (solo el CUIT/nombre/domicilio permitidos en `legal.ts`).

- **2026-10-08 (tarde)** — **Correcciones previas al lanzamiento commiteadas:** SKU en la ficha de producto solo cuando es real de variante (sin fallbacks de slug ni `'DEMO-SKU-001'`; `sku` en el JSON-LD solo si es real), eliminación de la sección "Reseñas y calificaciones" de ejemplo (criterio: nunca puntajes ni reseñas que no sean reales) y copy de garantía en `TrustBar`/`BenefitsSection` a "garantía legal de 6 meses" (alineado con Términos y Devoluciones 3.3). `PROJECT_STATUS.md` con las deudas de SKU resueltas y la verificación periódica de copy vs. Términos como pendiente. Verificado contra la línea base (`tsc -b` 52, lint 67, build OK), grep de cadenas de ejemplo sin matches y escaneo de secretos sin matches.

- **2026-10-08** — **SEO base (fase 1) commiteado:** componente `Seo` sin dependencias (title, description, canonical, og/twitter, robots y JSON-LD por página, con restauración de defaults al salir), `index.html` con `lang="es"`, metadatos por defecto, noscript y favicon/`apple-touch-icon` livianos, `robots.txt` con `Disallow` de rutas privadas, `og-default.png` 1200×630, JSON-LD Organization + WebSite en Home y Product en la ficha, `noindex` en páginas privadas, de pago, auth, admin, búsqueda (follow) y 404, y URL base única en `src/config/site.ts`. `PROJECT_STATUS.md` actualizado (lang=en resuelto, deuda nueva de fase 2). Verificado contra la línea base (`tsc -b` 52, lint 67, build OK) y escaneo de secretos sin matches.

- **2026-10-07 (noche)** — Commit de los ajustes visuales del checkout y de las páginas de pago: selector de medios de pago en fila de 3 desde xl, `/pago/transferencia` copiando solo alias y CBU (titular y banco como texto fijo), `/pago/transferencia` y `/pago/usdt` en 2 columnas desde lg; `PROJECT_STATUS.md` actualizado con el QA de punta a punta de transferencia del dueño (hecho; su limpieza de datos queda como pendiente) y deuda técnica nueva (warning de React en `CheckoutStepEnvio`, `max-w-md` de `PaymentOrderSummary`, desborde del selector a 1024 px, `lang="en"` para la tarea de SEO, botón de cancelación en páginas de pago y la limpieza del QA). Verificado contra la línea base (`tsc -b` 52, lint 67, build OK, escaneo de secretos sin matches).
- **2026-10-07 (tarde)** — Tanda de transferencia + frontend: `create-payment-transfer` desplegada (v1) y `create-payment`/`create-payment-usdt` redeployadas con el guard `PENDING_TRANSFER_ORDER` (v33/v17); QA completo de la función con la cuenta QA (401 gateway, 200 con payment `transfer`, 409 en los tres métodos, stock restaurado exacto y datos de prueba sin huérfanos); reconciliación de versiones (el código desplegado coincidía 100% con el repo). Frontend sin commitear hasta ahora: tercer método de pago con `/pago/transferencia`, páginas Nosotros/Preguntas frecuentes/Envíos/Medios de pago/Contacto, TopBar mobile, envío gratis y plazo de entrega 6-7 días hábiles, Términos 1.6.3 y devoluciones 3.2/3.5. Verificado contra la línea base (build Vite, `tsc -b` 52, lint 67, `deno check` OK) y escaneo de secretos sin matches.
- **2026-10-07** — Fix del layout de `/register` con panel scrolleable en desktop y formulario más compacto (`ccaa8c3`), verificado contra la línea base (build Vite, `tsc -b` 52, lint 67). Rotación del topic de ntfy (app y secret `NTFY_TOPIC` con el mismo valor; el valor no queda documentado), botón flotante de WhatsApp verificado en producción y wallet USDT confirmada por el dueño (la regla de verificar el depósito en Binance antes de confirmar sigue en pie). Versiones de las Edge Functions verificadas con la CLI y este documento actualizado a 2026-10-07.
- **2026-10-06** — Cierre del bloque legal y del arrepentimiento: textos legales publicados con aceptación en checkout y registro (`c5ddfc4`), backend del arrepentimiento con tabla, Edge Function y RPC (`f16ace3`), frontend con página `/arrepentimiento`, constancia, estado en pedidos y pantalla de gestión con contador en el menú (`04be7bb`), arreglos de diseño de las tablas del admin (`925f9b6`) y `.gitignore` ampliado a `.env*` (`00b9ab7`). Verificaciones contra la línea base (build Vite, `tsc -b` en 52, lint en 67) y revisión de secretos sobre todo el diff antes del push. En seguridad: neutralización de la cuenta de QA con rol admin (rol bajado, contraseña aleatoria y bloqueo), auditoría del repo y de su historial sin claves ni tokens expuestos, y constancias de prueba de arrepentimiento borradas con la secuencia reiniciada para que la próxima constancia sea `ARR-000001`.
- **2026-10-05** — Cierre del bloque de QA post-pago: bug del carrito corregido antes de pagar (`8fc4a5c`), variantes de producto con galería propia por variante, dropdown y drag & drop de imágenes con 4 migraciones aplicadas en remoto (`b8dc73a`), backend y frontend del pago USDT con guard 409, ntfy, emails y página `/pago/usdt` (`6f52bc6`), sidebar de subcategorías (`a39767a`), teléfono obligatorio con WhatsApp en el detalle de pedido (`2a5fbb7`) y franja de medios de pago en Home y ficha (`fbd7cff`). Todo commiteado y pusheado; verificación en vivo de RLS, cron de expiración y Edge Functions desplegadas en la BD remota; bug de `useCatalog` confirmado resuelto.
- **2026-10-05** — Cierre del bloque de stock: `cancel_order` con idempotencia por saldo neto y 3 inventarios huérfanos corregidos (`739706e`); guard de pedidos cancelados en pagos + avisos de stock/reembolso en el admin (`4f63f32`); `confirm_sale` al aprobar pagos manuales USDT (`a039a94`); endurecimiento de `create-payment-usdt` y `order-creation` ante fallos, timeouts y errores de release (`6fe9152`). Migraciones aplicadas en remoto; funciones redeployadas (`create-payment` v27, `create-payment-usdt` v11).
- **2026-09-25** — Auditoría inicial completa vía opencode. Diagnóstico: falta conectar pago end-to-end. Enviado prompt de estabilización (commits, bug useCatalog, RLS, .env.example, README).
