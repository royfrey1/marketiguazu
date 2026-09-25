import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { profileService, type Profile } from '../../services/profile.service'
import AccountSidebar, { type SidebarTab } from './AccountSidebar'
import AccountMobileNav from './AccountMobileNav'
import AdminAccountSection from './AdminAccountSection'
import SecuritySection from './SecuritySection'

export default function AdminProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<SidebarTab>('datos')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-gray-400 animate-pulse">Cargando perfil...</p>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-0">
      <AccountSidebar
        profile={profile}
        active={activeTab}
        onChange={setActiveTab}
        onProfileUpdate={setProfile}
        customer={false}
      />

      <div className="flex-1 min-w-0">
        <AccountMobileNav
          profile={profile}
          active={activeTab}
          onChange={setActiveTab}
          onProfileUpdate={setProfile}
          customer={false}
        />

        <div className="hidden lg:block p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'datos' && <AdminAccountSection profile={profile} onUpdate={setProfile} />}
            {activeTab === 'seguridad' && <SecuritySection email={profile.email} />}
          </motion.div>
        </div>

        <div className="lg:hidden p-4">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'datos' && <AdminAccountSection profile={profile} onUpdate={setProfile} />}
            {activeTab === 'seguridad' && <SecuritySection email={profile.email} />}

            <div className="mt-6">
              <Link
                to="/admin"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold bg-primary-dark text-white hover:bg-primary-dark/90 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Panel de administración
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
