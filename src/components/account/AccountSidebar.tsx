import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Camera } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { profileService } from '../../services/profile.service'
import { uploadService } from '../../services/upload.service'
import type { Profile } from '../../services/profile.service'

export type SidebarTab = 'datos' | 'direcciones' | 'favoritos' | 'pedidos' | 'seguridad'

interface AccountSidebarProps {
  profile: Profile
  active: SidebarTab
  onChange: (tab: SidebarTab) => void
  onProfileUpdate?: (updated: Profile) => void
  customer?: boolean
}

const customerNav = [
  { id: 'datos' as SidebarTab, label: 'Mi perfil' },
  { id: 'direcciones' as SidebarTab, label: 'Direcciones' },
  { id: 'favoritos' as SidebarTab, label: 'Favoritos' },
  { id: 'pedidos' as SidebarTab, label: 'Mis pedidos' },
  { id: 'seguridad' as SidebarTab, label: 'Seguridad' },
]

const adminNav = [
  { id: 'datos' as SidebarTab, label: 'Mi perfil' },
  { id: 'seguridad' as SidebarTab, label: 'Seguridad' },
]

export default function AccountSidebar({ profile, active, onChange, onProfileUpdate, customer = true }: AccountSidebarProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const navItems = customer ? customerNav : adminNav

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
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-primary-dark rounded-2xl overflow-hidden">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative group">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center text-white font-bold text-lg uppercase overflow-hidden shrink-0">
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
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{profile.nombre || 'Usuario'}</p>
          </div>
        </div>

        {profile.role === 'admin' && (
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white/80 px-2.5 py-1 rounded-full">
            Administrador
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 pb-3">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">Cuenta</p>
        <div className="space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                active === item.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/8 hover:text-white/90'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!customer && (
          <>
            <p className="px-3 mt-5 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">Administración</p>
            <a
              href="/admin"
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-accent hover:bg-white/8 transition-colors"
            >
              Panel de administración
            </a>
          </>
        )}
      </nav>

      <div className="p-3 mt-auto">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
