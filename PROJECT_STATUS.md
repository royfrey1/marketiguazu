# Iguazú Marketplace — Estado del Proyecto

**Última actualización:** 2026-09-25
**Fuente:** Auditoría de opencode (lectura de código, sin QA manual, sin conexión en vivo a la BD)

> Este documento es la fuente de verdad de en qué fase estamos. Actualizarlo después de cada sesión de trabajo relevante (no hace falta después de cada micro-tarea).

---

## 🎯 Momento actual

Estamos en el **puente entre Fase 6 (Checkout) y Fase 8 (Pedidos)**: la mayor parte de la tienda está construida y funcionando, pero **el checkout nunca crea un pedido real** porque el frontend no invoca la Edge Function de pago que ya existe. Conectar esa pieza es la prioridad #1 para acercarnos al lanzamiento.

---

## 🚨 Bloqueadores críticos (resolver en este orden)

1. **120 archivos sin commitear** desde `9b636e7` — riesgo de pérdida de trabajo. Resolver antes que nada.
2. **RLS sin confirmar** en `carts`, `cart_items`, `favorites`, `addresses`, `products`, `categories`, `price_history` — el repo no las protege; falta verificar el estado real en la base remota.
3. **Bug de loading infinito** en `useCatalog` (`src/hooks/useProducts.ts:84-91`) — sin try/catch/finally, si falla la query el skeleton queda colgado.
4. **Checkout no conectado a `create-payment`** — 0 referencias en `src/`. El botón de pago está deshabilitado.
5. **Webhook de Mercado Pago no implementado** — sin esto, ningún pago se confirma de forma segura (server-side).

---

## 📋 Roadmap — estado por fase

| Fase | Estado | Nota |
|---|---|---|
| 0 — Auditoría | ✅ Completa | |
| 1 — Fundación técnica | ✅ Completa | TS strict, layouts, design tokens, rutas protegidas |
| 2 — Base de datos | 🔶 Parcial | 16 tablas + specs completas; falta cerrar RLS |
| 3 — Auth/usuarios | ✅ Completa | |
| 4 — Catálogo | ✅ Completa | Home, búsqueda, PDP, variantes, favoritos |
| 5 — Carrito | ✅ Completa | Invitado + sincronización con login |
| 6 — Checkout | 🔶 Parcial | Envío y resumen listos; **pago deshabilitado** |
| 7 — Mercado Pago | 🔶 Parcial | Edge Function lista; **frontend no la llama**; **sin webhook** |
| 8 — Pedidos | 🔶 Parcial | UI de "Mis pedidos" y admin listas; nadie crea pedidos aún vía UI |
| 9 — Envíos | 🔶 Parcial | Proveedores manuales + cotizador Correo Argentino; falta wiring con el pedido real |
| 10 — Admin | 🔶 Parcial | Falta módulo **Clientes** |
| 11 — Seguridad/QA | 🔶 Parcial | Falta auditoría RLS efectiva + checklist de casos extremos |
| 12 — SEO/Performance | 🔶 Parcial | Performance ok; SEO casi todo pendiente (lang, meta, sitemap, robots) |
| 13 — Lanzamiento | ⬜ No iniciada | |

---

## 🧹 Deuda técnica no bloqueante (post-lanzamiento)

- `tailwind.config.js` duplicado, probablemente inactivo bajo Tailwind 4
- SEO: `lang="en"` (debería ser "es"), sin meta description/OG, sin sitemap/robots.txt
- 28 problemas reales de eslint (hooks deps, unused vars) — el resto son de `backup/` (vendor, ignorar)
- Chunk de build >500kb
- Hardcodeos: `'DEMO-SKU-001'` en ProductPage, `SITE_URL` fallback, link a portfolio personal en Footer
- Sin script `typecheck`, sin tests
- README desactualizado (template default de Vite)

---

## ✅ Próximos pasos (orden recomendado)

1. **Estabilización** — commitear trabajo pendiente, fix bug useCatalog, generar `.env.example`, confirmar RLS real, actualizar README *(prompt ya enviado — ver historial)*
2. **Conectar el pago end-to-end** — frontend → `create-payment`, implementar webhook, páginas de resultado leyendo estado real del pedido
3. **Cerrar RLS faltante** en las tablas identificadas
4. **QA de casos extremos** (Fase 11): stock 0, pago duplicado, compras simultáneas
5. **SEO básico + limpieza de Tailwind config** (Fase 12)
6. **Checklist de lanzamiento** (Fase 13)

---

## 🗂️ Historial de sesiones

- **2026-09-25** — Auditoría inicial completa vía opencode. Diagnóstico: falta conectar pago end-to-end. Enviado prompt de estabilización (commits, bug useCatalog, RLS, .env.example, README).
