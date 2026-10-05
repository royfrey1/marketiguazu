import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sileo'
import AuthProvider from './components/auth/AuthProvider'
import CartProvider from './components/cart/CartProvider'
import StoreLayout from './layouts/StoreLayout'
import AuthLayout from './layouts/AuthLayout'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AdminRoute from './components/auth/AdminRoute'

const THEME_KEY = 'admin.theme'
const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null

const HomePage = lazy(() => import('./pages/store/HomePage'))
const SearchPage = lazy(() => import('./pages/store/SearchPage'))
const ProductPage = lazy(() => import('./pages/store/ProductPage'))
const CategoryPage = lazy(() => import('./pages/store/CategoryPage'))
const ReportPage = lazy(() => import('./pages/admin/ReportPage'))
const CartPage = lazy(() => import('./pages/cart/CartPage'))
const CheckoutPage = lazy(() => import('./pages/checkout/CheckoutPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const ProfilePage = lazy(() => import('./pages/account/ProfilePage'))

const DashboardAdminPage = lazy(() => import('./pages/admin/DashboardAdminPage'))
const ProductsAdminPage = lazy(() => import('./pages/admin/ProductsAdminPage'))
const ProductCreatePage = lazy(() => import('./pages/admin/ProductCreatePage'))
const ProductEditPage = lazy(() => import('./pages/admin/ProductEditPage'))
const CategoriesAdminPage = lazy(() => import('./pages/admin/CategoriesAdminPage'))
const InventoryAdminPage = lazy(() => import('./pages/admin/InventoryAdminPage'))
const OrdersAdminPage = lazy(() => import('./pages/admin/OrdersAdminPage'))
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrderDetailPage'))
const AdminAccountPage = lazy(() => import('./pages/admin/AdminAccountPage'))
const NotFoundPage = lazy(() => import('./pages/store/NotFoundPage'))
const CategoryIndexPage = lazy(() => import('./pages/store/CategoryIndexPage'))
const OrdersPage = lazy(() => import('./pages/account/OrdersPage'))
const OrderDetailPage = lazy(() => import('./pages/account/OrderDetailPage'))
const PaymentSuccessPage = lazy(() => import('./pages/payment/PaymentSuccessPage'))
const PaymentPendingPage = lazy(() => import('./pages/payment/PaymentPendingPage'))
const PaymentFailurePage = lazy(() => import('./pages/payment/PaymentFailurePage'))
const PaymentUsdtPage = lazy(() => import('./pages/payment/PaymentUsdtPage'))

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Cargando...</p>
    </div>
  )
}

function App() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark'
    } catch {
      return false
    }
  })

  const [isMobile, setIsMobile] = useState(() => mobileQuery?.matches ?? false)

  useEffect(() => {
    if (!mobileQuery) return
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mobileQuery.addEventListener('change', handler)
    return () => mobileQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light') } catch { /* noop */ }
  }, [dark])

  const toggleTheme = useCallback(() => setDark(prev => !prev), [])

  return (
    <AuthProvider>
      <CartProvider>
        <Toaster
          position={isMobile ? 'top-center' : 'top-right'}
          theme={dark ? 'dark' : 'light'}
          offset={isMobile ? { top: 124 } : { top: 140, right: 16 }}
          options={{
            roundness: 12,
            duration: 5000,
            styles: {
              title: 'font-bold!',
            },
          }}
        />
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout dark={dark} onToggleTheme={toggleTheme} />}>
                <Route path="admin" element={<DashboardAdminPage />} />
                <Route path="admin/productos/nuevo" element={<ProductCreatePage />} />
                <Route path="admin/productos/:id/editar" element={<ProductEditPage />} />
                <Route path="admin/productos" element={<ProductsAdminPage />} />
                <Route path="admin/categorias" element={<CategoriesAdminPage />} />
                <Route path="admin/inventario" element={<InventoryAdminPage />} />
                <Route path="admin/pedido/:id" element={<AdminOrderDetailPage />} />
                <Route path="admin/pedidos" element={<OrdersAdminPage />} />
                <Route path="admin/cuenta" element={<AdminAccountPage />} />
              </Route>
            </Route>

            <Route element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<StoreLayout />}>
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="pedidos" element={<OrdersPage />} />
                <Route path="pedido/:id" element={<OrderDetailPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
              </Route>
            </Route>

            <Route element={<StoreLayout />}>
              <Route index element={<HomePage />} />
              <Route path="busqueda" element={<SearchPage />} />
              <Route path="categoria" element={<CategoryIndexPage />} />
              <Route path="categoria/:slug" element={<CategoryPage />} />
              <Route path="producto/:slug" element={<ProductPage />} />
              <Route path="report" element={<ReportPage />} />
              <Route path="carrito" element={<CartPage />} />
              <Route path="pago/exito" element={<PaymentSuccessPage />} />
              <Route path="pago/pendiente" element={<PaymentPendingPage />} />
              <Route path="pago/fallo" element={<PaymentFailurePage />} />
              <Route path="pago/usdt" element={<PaymentUsdtPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
