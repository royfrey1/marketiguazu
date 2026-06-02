import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
    whatsapp: '',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
  e.preventDefault()
  setLoading(true)
  setError(null)

  if (form.password !== form.confirmPassword) {
    setError("Las contraseñas no coinciden")
    setLoading(false)
    return
  }

  // Validación manual de WhatsApp
  if (form.whatsapp.length < 10) {
    setError("El número de WhatsApp es demasiado corto.");
    return;
  }

  try {
    // 1. Crear usuario
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      passwordConfirm: form.confirmPassword,
    })
    if (authError) throw authError

    // 2. Iniciar sesión inmediatamente
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (loginError) throw loginError

    // 3. Insertar perfil ya con sesión activa
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        nombre: form.nombre,
        whatsapp: form.whatsapp,
        ciudad: 'Iguazú',
      })
    if (profileError) throw profileError

    navigate('/dashboard')
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen bg-[#1b382f] flex items-center justify-center px-4 pt-30 pb-10 relative overflow-hidden">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 
            rounded-[2rem] md:rounded-[2.5rem] 
            p-6 md:p-10 
            shadow-2xl relative z-10">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2 text-center tracking-tighter">
          Crear cuenta
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-black text-[#B5E3D4] uppercase tracking-widest ml-4 mb-2 block">Nombre</label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              minLength={3}
              onChange={handleChange}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#B5E3D4] transition-colors"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="text-sm font-black text-[#B5E3D4] uppercase tracking-widest ml-4 mb-2 block">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#B5E3D4] transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="text-sm font-black text-[#B5E3D4] uppercase tracking-widest ml-4 mb-2 block">Contraseña</label>
            <label className="text-xs text-white tracking-widest ml-4 mb-2 block">Requisito: mínimo 6 caracteres</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#B5E3D4] transition-colors"
              placeholder="Introduce una contraseña"
            />
          </div>
          
          <div>
            <label className="text-sm font-black text-[#B5E3D4] uppercase tracking-widest ml-4 mb-2 block">Confirmar contraseña</label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#B5E3D4] transition-colors"
              placeholder="Introduce nuevamente tu contraseña"
            />
          </div>
 
          <div>
            <label className="text-sm font-black text-[#B5E3D4] uppercase tracking-widest ml-4 mb-2 block">WhatsApp</label>
            <input
              type="text"
              name="whatsapp"
              value={form.whatsapp}
              onChange={handleChange}
              pattern="[0-9]{10,15}"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#B5E3D4] transition-colors"
              placeholder="+54 3757 000000"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#B5E3D4] hover:bg-white disabled:opacity-50 text-[#050810] font-bold py-3 rounded-xl transition-colors mt-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}