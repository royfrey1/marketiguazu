import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (authError) throw authError

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D3732] flex items-center justify-center px-4 pt-35 pb-10 relative overflow-hidden">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 
            rounded-[2rem] md:rounded-[2.5rem] 
            p-6 md:p-10 
            shadow-2xl relative z-10">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2 text-center tracking-tighter">
          Bienvenido de nuevo
        </h2>
        <p className="text-center text-[#B5E3D4] text-xs font-bold uppercase tracking-widest mb-8">
          Iguazú Marketplace
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-2xl mb-6 text-center">
          {error === 'Invalid login credentials' ? 'Credenciales incorrectas' : error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          <div>
            <label className="text-sm font-black text-[#B5E3D4] uppercase tracking-widest ml-4 mb-2 block">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-2.5 md:py-3.5 text-white text-sm focus:outline-none focus:border-[#B5E3D4] transition-all placeholder:text-white/20"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="text-sm font-black text-[#B5E3D4] uppercase tracking-widest ml-4 mb-2 block">Contraseña</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-2.5 md:py-3.5 text-white text-sm focus:outline-none focus:border-[#B5E3D4] transition-all placeholder:text-white/20"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#B5E3D4] hover:bg-white disabled:opacity-50 text-[#050810] font-black py-3 md:py-4 rounded-full transition-all duration-300 mt-4 uppercase tracking-widest text-xs shadow-lg shadow-[#B5E3D4]/20 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="text-cyan-400 hover:text-cyan-300">
            Crear nueva cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}