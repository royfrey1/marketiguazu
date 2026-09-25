import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sileo } from 'sileo'
import { supabase } from '../../lib/supabase/client'

export default function RestablecerPassword() {
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const actualizarPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({
        password: nuevaPassword
      })

      if (error) throw error

      sileo.success("¡Contraseña actualizada con éxito! Ya podés iniciar sesión.")
      navigate('/login')
    } catch (error) {
      sileo.error("Error al actualizar la contraseña: " + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8 lg:mb-10">
        <h2 className="text-h2 text-2xl sm:text-3xl text-primary-dark">
          Nueva <span className="text-accent">Contraseña</span>
        </h2>
        <p className="text-body text-gray-500 mt-2">
          Ingresá tu nueva clave de acceso de forma segura.
        </p>
      </div>

      <form onSubmit={actualizarPassword} className="space-y-4">
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-1.5">Nueva Contraseña</label>
          <input
            type="password"
            required
            minLength={6}
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors mt-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Actualizando...' : 'Confirmar Nueva Contraseña'}
        </button>
      </form>
    </>
  )
}
