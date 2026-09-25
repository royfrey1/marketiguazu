import { useState } from 'react'
import { Shield, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase/client'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface SecuritySectionProps {
  email: string
}

type Feedback = { type: 'success' | 'error'; message: string } | null

export default function SecuritySection({ email }: SecuritySectionProps) {
  const [currentPass, setCurrentPass] = useState('')
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const handleVerify = async () => {
    setVerifying(true)
    setVerifyError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPass })
    setVerifying(false)
    if (error) {
      setVerifyError('Contraseña incorrecta')
      setVerified(false)
    } else {
      setVerifyError('')
      setVerified(true)
    }
  }

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setSaving(false)
    if (error) {
      setFeedback({ type: 'error', message: error.message })
    } else {
      setFeedback({ type: 'success', message: 'Correo actualizado. Revisa tu bandeja para confirmar.' })
      setNewEmail('')
      setVerified(false)
      setCurrentPass('')
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      setFeedback({ type: 'error', message: error.message })
    } else {
      setFeedback({ type: 'success', message: 'Contraseña actualizada correctamente.' })
      setNewPassword('')
      setVerified(false)
      setCurrentPass('')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary-dark">Seguridad</h2>
        <p className="text-sm text-gray-500 mt-0.5">Gestioná tus credenciales de acceso.</p>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 sm:p-3 rounded-xl text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-secondary/10 text-secondary'
            : 'bg-red-50 text-red-600'
        }`}>
          {feedback.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="p-4 sm:p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 sm:space-y-4">
        <h3 className="text-sm font-bold text-primary-dark flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          Verificar identidad
        </h3>

        <Input
          label="Contraseña actual"
          type="password"
          value={currentPass}
          onChange={e => { setCurrentPass(e.target.value); setVerifyError('') }}
          disabled={verified}
          placeholder="Ingresá tu contraseña actual"
        />

        <Button
          type="button"
          variant="outline"
          onClick={handleVerify}
          disabled={verified || !currentPass}
          loading={verifying}
          className="w-full sm:w-auto sm:self-start min-h-11"
        >
          {verified ? 'Verificada' : 'Verificar'}
        </Button>

        {verifyError && <p className="text-red-500 text-xs font-medium">{verifyError}</p>}
      </div>

      <form onSubmit={handleEmailChange} className="p-4 sm:p-5 bg-white rounded-2xl border border-gray-100 space-y-4 sm:space-y-4">
        <h3 className="text-sm font-bold text-primary-dark">Cambiar correo electrónico</h3>
        <Input
          label="Nuevo correo"
          type="email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          disabled={!verified}
          placeholder="ejemplo@nuevo.com"
          required
        />
        <Button type="submit" disabled={!verified || !newEmail} loading={saving} className="w-full sm:w-auto sm:self-start min-h-11">
          Guardar nuevo email
        </Button>
      </form>

      <form onSubmit={handlePasswordChange} className="p-4 sm:p-5 bg-white rounded-2xl border border-gray-100 space-y-4 sm:space-y-4">
        <h3 className="text-sm font-bold text-primary-dark">Cambiar contraseña</h3>
        <Input
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          disabled={!verified}
          placeholder="Mínimo 6 caracteres"
          required
        />
        <Button type="submit" disabled={!verified || !newPassword} loading={saving} className="w-full sm:w-auto sm:self-start min-h-11">
          Guardar nueva contraseña
        </Button>
      </form>
    </div>
  )
}
