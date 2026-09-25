# Iguazú Marketplace

E-commerce de venta directa (single-vendor) para Iguazú: catálogo público con
búsqueda y categorías, ficha de producto con variantes, stock y precio en
tiempo real, carrito, checkout con envíos (Correo Argentino) y panel de
administración (productos, categorías, inventario y órdenes).

## Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7
- **Backend:** Supabase (PostgreSQL con Row Level Security, Auth, Storage) y
  Edge Functions en Deno (`supabase/functions`)
- **Pagos:** Mercado Pago, integrado vía la Edge Function `create-payment`
- **UI:** Lucide, framer-motion, sileo (notificaciones)

## Requisitos

- Node.js 20 o superior
- Un proyecto de Supabase (base de datos, Auth y Storage)

## Variables de entorno

Copiá `.env.example` a `.env` y completá los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anon/public de Supabase |
| `VITE_APP_URL` | URL pública de la app |
| `VITE_WHATSAPP_URL` | Link de WhatsApp de atención |

Los secretos de las Edge Functions (`MERCADOPAGO_ACCESS_TOKEN`, `SITE_URL`,
`CORREO_ARGENTINO_ENV`, `CORREO_ARGENTINO_USER`, `CORREO_ARGENTINO_PASSWORD`)
se configuran en el Dashboard de Supabase, no en `.env`. Ver `.env.example`.

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:5173
```

Otros scripts: `npm run build` (build de producción), `npm run lint` (ESLint),
`npm run preview` (previsualiza el build).

## Base de datos

El esquema de referencia está en `supabase/schema-aprobado-1.7.2.sql` y las
migraciones versionadas en `supabase/migrations/`. Aplicarlas al proyecto
remoto: `supabase db push` (requiere `supabase login` y el proyecto enlazado).
