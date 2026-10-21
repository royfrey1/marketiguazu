import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from "@vercel/analytics/react"
import './index.css'
import App from './App'
import { applyRouteArea } from './lib/routeArea'

// Antes del primer render: el admin no recibe la escala de la tienda (index.css)
applyRouteArea(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
