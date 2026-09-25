import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, ArrowRight } from 'lucide-react'
import { sileo } from 'sileo'
import { supabase } from '../../lib/supabase/client'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (authError) throw authError

      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const recuperarContrasena = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email) {
      sileo.warning({ title: "Correo requerido", description: "Por favor, ingresá tu correo electrónico primero." })
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${import.meta.env.VITE_APP_URL}/reset-password`,
      })

      if (error) throw error
      sileo.success({ title: "Correo enviado", description: "Revisá tu casilla de correo (y la carpeta de spam)." })
    } catch (error) {
      sileo.error({ title: "No se pudo enviar el correo", description: (error as Error).message })
    }
  }

  return (
    <>
      <div className="mb-8 lg:mb-10">
        <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark">
          Ingresá a tu cuenta
        </h1>
        <p className="text-body text-gray-500 mt-2">
          Comprá en Iguazú Marketplace
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-6" role="alert">
          {error === 'Invalid login credentials' ? 'Credenciales incorrectas' : error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          required
          placeholder="tu@email.com"
          autoComplete="email"
        />

        <Input
          label="Contraseña"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          required
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <div className="text-right">
          <button
            type="button"
            onClick={recuperarContrasena}
            className="text-sm text-accent hover:text-accent/80 font-medium transition-colors cursor-pointer"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={loading}
        >
          {!loading && <LogIn className="w-4 h-4" />}
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="text-accent hover:text-accent/80 font-bold transition-colors inline-flex items-center gap-1">
            Crear cuenta
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </p>
      </div>
    </>
  )
}
