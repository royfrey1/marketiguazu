import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import useAuth from '../../hooks/useAuth'
import { profileService, type Profile } from '../../services/profile.service'
import AccountSidebar, { type SidebarTab } from './AccountSidebar'
import AccountMobileNav from './AccountMobileNav'
import PersonalDataSection from './PersonalDataSection'
import AddressesSection from './AddressesSection'
import FavoritesSection from './FavoritesSection'
import OrdersSection from './OrdersSection'
import SecuritySection from './SecuritySection'

export default function CustomerProfile() {
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
        customer
      />

      <div className="flex-1 min-w-0">
        <AccountMobileNav
          profile={profile}
          active={activeTab}
          onChange={setActiveTab}
          onProfileUpdate={setProfile}
          customer
        />

        <div className="hidden lg:block p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'datos' && <PersonalDataSection profile={profile} onUpdate={setProfile} />}
            {activeTab === 'direcciones' && <AddressesSection userId={profile.id} />}
            {activeTab === 'favoritos' && <FavoritesSection userId={profile.id} />}
            {activeTab === 'pedidos' && <OrdersSection />}
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
            {activeTab === 'datos' && <PersonalDataSection profile={profile} onUpdate={setProfile} />}
            {activeTab === 'direcciones' && <AddressesSection userId={profile.id} />}
            {activeTab === 'favoritos' && <FavoritesSection userId={profile.id} />}
            {activeTab === 'pedidos' && <OrdersSection />}
            {activeTab === 'seguridad' && <SecuritySection email={profile.email} />}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
