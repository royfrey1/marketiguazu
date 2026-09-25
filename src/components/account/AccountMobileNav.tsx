import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Camera, ChevronDown } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { profileService } from '../../services/profile.service'
import { uploadService } from '../../services/upload.service'
import type { Profile } from '../../services/profile.service'

export type MobileTab = 'datos' | 'direcciones' | 'favoritos' | 'pedidos' | 'seguridad'

interface AccountMobileNavProps {
  profile: Profile
  active: MobileTab
  onChange: (tab: MobileTab) => void
  onProfileUpdate?: (updated: Profile) => void
  customer?: boolean
}

const customerNav: { id: MobileTab; label: string }[] = [
  { id: 'datos', label: 'Mi perfil' },
  { id: 'direcciones', label: 'Direcciones' },
  { id: 'favoritos', label: 'Favoritos' },
  { id: 'pedidos', label: 'Mis pedidos' },
  { id: 'seguridad', label: 'Seguridad' },
]

const adminNav: { id: MobileTab; label: string }[] = [
  { id: 'datos', label: 'Mi perfil' },
  { id: 'seguridad', label: 'Seguridad' },
]

export default function AccountMobileNav({ profile, active, onChange, onProfileUpdate, customer = true }: AccountMobileNavProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = customer ? customerNav : adminNav
  const activeLabel = navItems.find(n => n.id === active)?.label || ''

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const { data: uploadData, error: uploadError } = await uploadService.uploadAvatar(profile.id, file)
      if (uploadError) throw uploadError
      const { error: updateError } = await profileService.update(profile.id, { avatar_url: uploadData!.url })
      if (updateError) throw updateError
      onProfileUpdate?.({ ...profile, avatar_url: uploadData!.url })
    } catch (err) {
      console.error('Error uploading avatar:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const initials = profile.nombre
    ? profile.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="lg:hidden space-y-4">
      <div className="flex items-center gap-4 p-4 bg-primary-dark rounded-2xl">
        <div className="relative group shrink-0">
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-white font-bold text-base uppercase overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.nombre} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            aria-label="Cambiar foto"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{profile.nombre || 'Usuario'}</p>
          <p className="text-xs text-white/50 truncate">{profile.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="p-2 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-primary-dark cursor-pointer"
        >
          {activeLabel}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { onChange(item.id); setMenuOpen(false) }}
                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                  active === item.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            {!customer && (
              <a
                href="/admin"
                className="block w-full text-left px-4 py-3 text-sm font-medium text-accent border-t border-gray-100 hover:bg-gray-50 transition-colors"
              >
                Panel de administración
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
