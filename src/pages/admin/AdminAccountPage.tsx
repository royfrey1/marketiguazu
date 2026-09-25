import { useState, useEffect } from 'react'
import useAuth from '../../hooks/useAuth'
import { profileService, type Profile } from '../../services/profile.service'
import AdminProfileSection from '../../components/admin/account/AdminProfileSection'
import AdminSecuritySection from '../../components/admin/account/AdminSecuritySection'

export default function AdminAccountPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await profileService.getById(user.id)
      if (!cancelled) {
        setProfile(data)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const email = user?.email || ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Cuenta</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
          Gestioná tu perfil y configuración administrativa.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center">
          <p className="text-gray-400 dark:text-white/30 animate-pulse">Cargando perfil...</p>
        </div>
      ) : profile ? (
        <>
          <AdminProfileSection profile={profile} onUpdate={setProfile} />
          <AdminSecuritySection email={email} />
        </>
      ) : null}
    </div>
  )
}
