import { useState, useRef } from 'react'
import { User, Check, Camera, Shield } from 'lucide-react'
import useAuth from '../../../hooks/useAuth'
import { profileService, type Profile } from '../../../services/profile.service'
import { uploadService } from '../../../services/upload.service'

interface AdminProfileSectionProps {
  profile: Profile
  onUpdate: (p: Profile) => void
}

type Feedback = { type: 'success' | 'error'; message: string } | null

export default function AdminProfileSection({ profile, onUpdate }: AdminProfileSectionProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [nombre, setNombre] = useState(profile.nombre || '')
  const [telefono, setTelefono] = useState(profile.telefono || '')
  const [ciudad, setCiudad] = useState(profile.ciudad || '')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const email = user?.email || ''
  const initials = profile.nombre
    ? profile.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const { data: uploadData, error: uploadError } = await uploadService.uploadAvatar(profile.id, file)
      if (uploadError) throw uploadError
      const { error: updateError } = await profileService.update(profile.id, { avatar_url: uploadData!.url })
      if (updateError) throw updateError
      onUpdate({ ...profile, avatar_url: uploadData!.url })
    } catch {
      // silent — avatar upload is non-critical
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    const { data, error } = await profileService.update(profile.id, { nombre, telefono, ciudad })
    setSaving(false)
    if (error) {
      setFeedback({ type: 'error', message: error.message })
    } else {
      setFeedback({ type: 'success', message: 'Perfil actualizado.' })
      if (data) onUpdate(data)
    }
  }

  return (
    <div className="space-y-6">
      {/* Card: Identity */}
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-full bg-[#1CAAA8]/15 flex items-center justify-center text-[#1CAAA8] font-bold text-2xl uppercase overflow-hidden">
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
              aria-label="Cambiar foto de perfil"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Identity info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white truncate">{profile.nombre || 'Usuario'}</h2>
            <p className="text-sm text-gray-500 dark:text-white/40 truncate">{email}</p>
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1CAAA8]/15 text-[#1CAAA8]">
              <Shield className="w-3 h-3" />
              Administrador
            </span>
          </div>
        </div>
      </div>

      {/* Card: Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#185749]/10 dark:bg-[#1CAAA8]/10 flex items-center justify-center">
            <User className="w-4 h-4 text-[#185749] dark:text-[#1CAAA8]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Datos personales</h3>
            <p className="text-xs text-gray-400 dark:text-white/30">Información básica de tu cuenta administrativa.</p>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-[#389C52]/10 text-[#389C52] dark:bg-[#389C52]/15 dark:text-[#389C52]'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}>
            {feedback.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
            {feedback.message}
          </div>
        )}

        {/* Fields grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-nombre" className="text-xs font-bold text-gray-800 dark:text-white/70 uppercase">
              Nombre completo
            </label>
            <input
              id="admin-nombre"
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
            />
          </div>

          {/* Teléfono */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-telefono" className="text-xs font-bold text-gray-800 dark:text-white/70 uppercase">
              Teléfono
            </label>
            <input
              id="admin-telefono"
              type="text"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
            />
          </div>

          {/* Ciudad */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-ciudad" className="text-xs font-bold text-gray-800 dark:text-white/70 uppercase">
              Ciudad
            </label>
            <input
              id="admin-ciudad"
              type="text"
              value={ciudad}
              onChange={e => setCiudad(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors"
            />
          </div>

          {/* Email (readonly) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-email" className="text-xs font-bold text-gray-800 dark:text-white/70 uppercase">
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              readOnly
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/40 cursor-not-allowed"
            />
            <p className="text-[11px] text-gray-400 dark:text-white/25">
              El email se gestiona desde la sección de Seguridad.
            </p>
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-[#185749] dark:bg-[#1CAAA8] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}
