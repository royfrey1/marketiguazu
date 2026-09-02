import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthProvider from './components/auth/AuthProvider'
import StoreLayout from './layouts/StoreLayout'
import AuthLayout from './layouts/AuthLayout'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'

const HomePage = lazy(() => import('./pages/store/HomePage'))
const SearchPage = lazy(() => import('./pages/store/SearchPage'))
const ProductPage = lazy(() => import('./pages/store/ProductPage'))
const SellerPage = lazy(() => import('./pages/store/SellerPage'))
const ReportPage = lazy(() => import('./pages/admin/ReportPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const ProfilePage = lazy(() => import('./pages/account/ProfilePage'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const NewPublicationPage = lazy(() => import('./pages/admin/NewPublicationPage'))
const EditPublicationPage = lazy(() => import('./pages/admin/EditPublicationPage'))

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Cargando...</p>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route index element={<HomePage />} />
              <Route path="busqueda" element={<SearchPage />} />
              <Route path="publicacion/:id" element={<ProductPage />} />
              <Route path="vendedor/:id" element={<SellerPage />} />
              <Route path="report" element={<ReportPage />} />
            </Route>

            <Route element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<StoreLayout />}>
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="miperfil" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="nueva-publicacion" element={<NewPublicationPage />} />
                <Route path="editar-publicacion/:id" element={<EditPublicationPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Loading />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
