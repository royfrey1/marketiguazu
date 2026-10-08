import useAuth from '../../hooks/useAuth'
import Seo from '../../components/seo/Seo'
import CustomerProfile from '../../components/account/CustomerProfile'
import AdminProfile from '../../components/account/AdminProfile'

function ProfilePageContent() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="store-container section-spacing">
          <div className="flex items-center justify-center py-24">
            <p className="text-gray-400 animate-pulse">Cargando perfil...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="store-container section-spacing">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 min-h-[600px]">
          {profile.role === 'admin' ? <AdminProfile /> : <CustomerProfile />}
        </div>
      </div>
    </div>
  )
}

// noindex en todos los estados (cargando, error, vacío), no solo en el render principal
export default function ProfilePage() {
  return (
    <>
      <Seo noindex title="Mi perfil" />
      <ProfilePageContent />
    </>
  )
}
