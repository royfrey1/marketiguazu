import { useState } from 'react'
import { Check } from 'lucide-react'
import { profileService, type Profile } from '../../services/profile.service'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface PersonalDataSectionProps {
  profile: Profile
  onUpdate: (p: Profile) => void
}

type Feedback = { type: 'success' | 'error'; message: string } | null

export default function PersonalDataSection({ profile, onUpdate }: PersonalDataSectionProps) {
  const [nombre, setNombre] = useState(profile.nombre || '')
  const [telefono, setTelefono] = useState(profile.telefono || '')
  const [ciudad, setCiudad] = useState(profile.ciudad || '')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    const { data, error } = await profileService.update(profile.id, { nombre, telefono, ciudad })
    setSaving(false)
    if (error) {
      setFeedback({ type: 'error', message: error.message })
    } else {
      setFeedback({ type: 'success', message: 'Datos actualizados correctamente.' })
      if (data) onUpdate(data)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-primary-dark">Datos personales</h2>
        <p className="text-sm text-gray-500 mt-0.5">Mantené tu información actualizada.</p>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-secondary/10 text-secondary'
            : 'bg-red-50 text-red-600'
        }`}>
          {feedback.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <Input label="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} required />
      <Input label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 3757123456" />
      <Input label="Ciudad" value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Ej: Puerto Iguazú" />

      <Button type="submit" loading={saving} disabled={saving}>
        Guardar cambios
      </Button>
    </form>
  )
}
