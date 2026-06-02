import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import NuevaPublicacion from './pages/NuevaPublicacion'
import DetallePublicacion from './pages/DetallePublicacion'
import ProtectedRoute from './components/ProtectedRoute'
import EditarPublicacion from './pages/EditarPublicacion'
import PerfilVendedor from './pages/PerfilVendedor'
// import EditarPerfil from './pages/EditarPerfil'
import ResetPass from './pages/ResetPass'
import Busqueda from './pages/Busqueda'
import Btnfav from './pages/Btnfav'
import MiPerfil from './pages/Miperfil'

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/publicacion/:id" element={<DetallePublicacion />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/perfil" element={
          <ProtectedRoute>
            <MiPerfil />
          </ProtectedRoute>
        } />
        <Route path="/nueva-publicacion" element={
          <ProtectedRoute>
            <NuevaPublicacion />
          </ProtectedRoute>
        } />
        <Route path="/editar-publicacion/:id" element={
          <ProtectedRoute>
            <EditarPublicacion />
          </ProtectedRoute>
        } />
        <Route path="/miperfil" element={
          <ProtectedRoute>
            <MiPerfil />
          </ProtectedRoute>
        } />
        <Route path="/vendedor/:id" element={<PerfilVendedor />} />
        <Route path="/reset-password" element={<ResetPass />} />
        <Route path="/busqueda" element={<Busqueda />} />
        <Route path="/btnfav" element={<Btnfav />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App