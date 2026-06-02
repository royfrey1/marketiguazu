import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function RestablecerPassword() {
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const actualizarPassword = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      
      // Supabase detecta automáticamente el token de la URL y actualiza el usuario activo
      const { error } = await supabase.auth.updateUser({
        password: nuevaPassword
      })

      if (error) throw error

      alert("¡Contraseña actualizada con éxito! Ya podés iniciar sesión.")
      navigate('/login') // O la ruta de tu login
    } catch (error) {
      alert("Error al actualizar la contraseña: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1b382f] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 p-8 rounded-[2.5rem] shadow-2xl text-white">
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">
          Nueva <span className="text-[#1CAAA8]">Contraseña</span>
        </h2>
        <p className="text-white/50 text-xs font-medium mb-6">Ingresá tu nueva clave de acceso de forma segura.</p>

        <form onSubmit={actualizarPassword} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#B5E3D4] mb-2">Nueva Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-[#1CAAA8] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1CAAA8] hover:bg-[#B5E3D4] text-white hover:text-[#050810] font-black uppercase tracking-widest text-xs py-5 rounded-2xl transition-all shadow-lg"
          >
            {loading ? 'Actualizando...' : 'Confirmar Nueva Contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}