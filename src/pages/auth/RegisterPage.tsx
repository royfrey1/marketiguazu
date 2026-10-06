import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase/client'
import TermsAcceptance from '../../components/legal/TermsAcceptance'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
    telefono: '',
  })
  // Términos 1.1: registrarse implica aceptarlos, así que la aceptación es explícita
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!termsAccepted) {
      setTermsError(true)
      return
    }
    setLoading(true)
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden")
      setLoading(false)
      return
    }

    if (form.telefono.length < 10) {
      setError("El número de teléfono es demasiado corto.")
      setLoading(false)
      return
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: undefined },
      })
      if (authError) throw authError

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (loginError) throw loginError

      if (!data.user) throw new Error('No se pudo crear el usuario')

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          nombre: form.nombre,
          telefono: form.telefono,
          ciudad: 'Iguazú',
        })
      if (profileError) throw profileError

      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-6 lg:mb-8">
        <h2 className="text-h2 text-2xl sm:text-3xl text-primary-dark">
          Crear cuenta
        </h2>
        <p className="text-body text-gray-500 mt-1">
          Unite a Iguazú Marketplace
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Nombre</label>
          <input
            type="text"
            name="nombre"
            value={form.nombre}
            minLength={3}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Contraseña</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Confirmar contraseña</label>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            minLength={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            placeholder="Repetí tu contraseña"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Teléfono</label>
          <input
            type="text"
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
            pattern="[0-9]{10,15}"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            placeholder="+54 3757 000000"
          />
        </div>

        <div className="pt-1">
          <TermsAcceptance
            id="register-terms"
            checked={termsAccepted}
            onChange={checked => { setTermsAccepted(checked); if (checked) setTermsError(false) }}
            showError={termsError}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors mt-1 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Creando cuenta...' : 'Registrarse'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-accent hover:text-accent/80 font-bold transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Iniciar sesión
          </Link>
        </p>
      </div>
    </>
  )
}
