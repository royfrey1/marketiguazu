import { useState } from 'react'
import { Shield, ShieldCheck, Mail, KeyRound, Check } from 'lucide-react'
import { supabase } from '../../../lib/supabase/client'

interface AdminSecuritySectionProps {
  email: string
}

type Feedback = { type: 'success' | 'error'; message: string } | null

export default function AdminSecuritySection({ email }: AdminSecuritySectionProps) {
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

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-transparent text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#185749]/20 dark:focus:ring-[#1CAAA8]/20 focus:border-[#185749] dark:focus:border-[#1CAAA8] transition-colors'
  const inputDisabledClass = 'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/40 cursor-not-allowed'

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#185749]/10 dark:bg-[#1CAAA8]/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#185749] dark:text-[#1CAAA8]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Seguridad</h2>
            <p className="text-xs text-gray-400 dark:text-white/30">Gestioná tus credenciales de acceso.</p>
          </div>
        </div>
      </div>

      {/* Global feedback */}
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

      {/* Verify identity */}
      <div className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Verificar identidad</h3>
            <p className="text-[11px] text-gray-400 dark:text-white/25">Necesitamos confirmar que sos vos antes de realizar cambios.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="sec-current-pass" className="text-xs font-bold text-gray-800 dark:text-white/70 uppercase mb-1.5 block">
              Contraseña actual
            </label>
            <input
              id="sec-current-pass"
              type="password"
              value={currentPass}
              onChange={e => { setCurrentPass(e.target.value); setVerifyError('') }}
              disabled={verified}
              placeholder="Ingresá tu contraseña actual"
              className={verified ? inputDisabledClass : inputClass}
            />
          </div>
          <div className="sm:pt-5">
            <button
              type="button"
              onClick={handleVerify}
              disabled={verified || !currentPass}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? (
                <div className="w-4 h-4 border-2 border-gray-300 dark:border-white/20 border-t-gray-600 dark:border-t-white/60 rounded-full animate-spin" />
              ) : verified ? (
                <ShieldCheck className="w-4 h-4 text-[#389C52]" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {verified ? 'Verificada' : 'Verificar'}
            </button>
          </div>
        </div>

        {verifyError && (
          <p className="text-red-500 dark:text-red-400 text-xs font-medium">{verifyError}</p>
        )}
      </div>

      {/* Change email */}
      <form onSubmit={handleEmailChange} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Correo electrónico</h3>
            <p className="text-[11px] text-gray-400 dark:text-white/25">Actualizá tu correo de acceso.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="sec-new-email" className="text-xs font-bold text-gray-800 dark:text-white/70 uppercase mb-1.5 block">
              Nuevo correo
            </label>
            <input
              id="sec-new-email"
              type="email"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); if (feedback) setFeedback(null) }}
              disabled={!verified}
              placeholder={verified ? 'ejemplo@nuevo.com' : 'Verificá tu identidad primero'}
              className={!verified ? inputDisabledClass : inputClass}
            />
          </div>
          <div className="sm:pt-5">
            <button
              type="submit"
              disabled={!verified || !newEmail}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-[#185749] dark:bg-[#1CAAA8] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Guardar email
            </button>
          </div>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={handlePasswordChange} className="bg-white dark:bg-[#162420] rounded-xl border border-gray-200 dark:border-white/5 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <KeyRound className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Contraseña</h3>
            <p className="text-[11px] text-gray-400 dark:text-white/25">Actualizá tu contraseña de acceso.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="sec-new-pass" className="text-xs font-bold text-gray-800 dark:text-white/70 uppercase mb-1.5 block">
              Nueva contraseña
            </label>
            <input
              id="sec-new-pass"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              disabled={!verified}
              placeholder={verified ? 'Mínimo 6 caracteres' : 'Verificá tu identidad primero'}
              className={!verified ? inputDisabledClass : inputClass}
            />
          </div>
          <div className="sm:pt-5">
            <button
              type="submit"
              disabled={!verified || !newPassword}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-[#185749] dark:bg-[#1CAAA8] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Guardar contraseña
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
