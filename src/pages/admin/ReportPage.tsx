import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { reportService } from '../../services/report.service'

interface ReportForm {
  nombre: string
  email: string
  tipo_error: string
  descripcion: string
  seguridad_val: string
}

export default function ReportarProblema() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [checkingAuth] = useState(false)

  const [form, setForm] = useState<ReportForm>({
    nombre: '',
    email: user?.email || '',
    tipo_error: 'bug',
    descripcion: '',
    seguridad_val: '' // 🍯 CAMPO TRAMPA (HONEYPOT)
  })

  // Limpieza de memoria para el redireccionamiento
  useEffect(() => {
    let tiempoRedireccion: ReturnType<typeof setTimeout>;
    if (exito) {
      tiempoRedireccion = setTimeout(() => {
        navigate('/')
      }, 3500)
    }
    return () => clearTimeout(tiempoRedireccion)
  }, [exito, navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)

    // 🍯 VALIDACIÓN HONEYPOT: Si este campo tiene algo, es un BOT.
    if (form.seguridad_val !== '') {
      // Lo engañamos simulando éxito instantáneo, pero frenamos el proceso sin tocar Supabase
      setExito(true)
      setEnviando(false)
      return
    }

    // Doble verificación: Que no intenten saltearse el bloqueo visual
    if (!user) {
      setError('⚠️ Debés iniciar sesión para enviar un reporte.')
      setEnviando(false)
      return
    }

    // Freno por longitud mínima (Evita reportes vacíos o de una sola letra)
    if (form.descripcion.trim().length < 15) {
      setError('⚠️ Por favor, sé un poco más específico en la descripción (mínimo 15 caracteres).')
      setEnviando(false)
      return
    }

    try {
      // Insertamos el reporte vinculándolo al ID real del usuario de Supabase
      const { error: insertError } = await reportService.create({
            nombre: form.nombre.trim().substring(0, 100) || 'Usuario Registrado',
            email: form.email.trim().substring(0, 100),
            tipo_error: form.tipo_error,
            descripcion: form.descripcion.trim(),
            user_id: user.id
          })

      if (insertError) throw insertError

      setExito(true)
      setForm({ nombre: '', email: '', tipo_error: 'bug', descripcion: '', seguridad_val: '' })

    } catch (err) {
      setError('Hubo un problema al enviar el reporte. Por favor, intentá de nuevo.')
      console.error(err)
    } finally {
      setEnviando(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
        <p className="text-[#B5E3D4] animate-pulse font-bold tracking-widest">VERIFICANDO CREDENCIALES...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b382f] text-white">
      <div className="max-w-3xl mx-auto pt-20 md:pt-28 lg:pt-36 pb-12 px-4">
        
        {/* Cabecera común */}
        <div className="text-center mb-8">
          <span className="text-4xl">🛠️</span>
          <h1 className="text-3xl font-black tracking-tighter mt-2 text-[#B5E3D4]">Reportar un Problema</h1>
          <p className="text-white/60 text-sm mt-2 max-w-md mx-auto">
            Ayudanos a mantener Iguazú Marketplace funcionando al 100%.
          </p>
        </div>

        {/* CONDICIONAL: SI NO ESTÁ LOGUEADO, MURO DE LOGIN */}
        {!user ? (
          <div className="bg-white/5 backdrop-blur-xl border-2 border-red-500/20 rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl space-y-5 max-w-xl mx-auto">
            <span className="text-4xl block">🔒</span>
            <h3 className="text-xl font-bold text-[#B5E3D4]">Acceso Restringido</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Para evitar ataques de spam y proteger la estabilidad del servidor en Iguazú, necesitás tener una cuenta activa para enviar reportes de errores.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link 
                to="/login" 
                className="flex-1 bg-[#1CAAA8] hover:bg-[#15807e] text-white font-bold py-3 rounded-xl text-xs transition-all uppercase tracking-wider text-center no-underline flex items-center justify-center"
              >
                Iniciar Sesión
              </Link>
              <Link 
                to="/register" 
                className="flex-1 bg-transparent hover:bg-white/5 text-white/80 border border-white/20 font-bold py-3 rounded-xl text-xs transition-all text-center no-underline flex items-center justify-center"
              >
                Registrarme Gratis ✨
              </Link>
            </div>
          </div>
        ) : exito ? (
          /* PANTALLA DE ÉXITO */
          <div className="bg-[#B5E3D4]/20 border-2 border-[#B5E3D4] rounded-[2rem] p-8 text-center shadow-2xl">
            <span className="text-4xl block mb-2">🎉</span>
            <h3 className="text-xl font-bold text-[#B5E3D4]">¡Reporte enviado!</h3>
            <p className="text-white/80 text-sm mt-2">
              Muchas gracias por tu aviso. Lo revisaremos enseguida. Volviendo al inicio...
            </p>
          </div>
        ) : (
          /* FORMULARIO BLINDADO PARA USUARIOS LOGUEADOS */
          <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* 🍯 CAMPO TRAMPA (HONEYPOT) - TOTALMENTE OCULTO PARA HUMANOS */}
            <div className="hidden" aria-hidden="true">
              <input
                type="text"
                name="seguridad_val"
                value={form.seguridad_val}
                onChange={handleChange}
                tabIndex="-1"
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-white/60 mb-1 block font-medium">Tu Nombre (Opcional)</label>
                <input
                  type="text"
                  name="nombre"
                  maxLength={70}
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Juan de Iguazú"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-all placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="text-sm text-white/40 mb-1 block font-medium">Email Asociado (Bloqueado)</label>
                <input
                  type="email"
                  disabled
                  value={form.email}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/40 text-sm cursor-not-allowed select-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1 block font-medium">¿Dónde se produce el error?</label>
              <select
                name="tipo_error"
                value={form.tipo_error}
                onChange={handleChange}
                className="w-full bg-[#1b382f] border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-all cursor-pointer"
              >
                <option value="bug">🐛 Algo no funciona (Error de código / Bug)</option>
                <option value="visual">🎨 Detalle visual (Imágenes rotas / Desalineado)</option>
                <option value="publicacion">⚠️ Denunciar publicación o estafa</option>
                <option value="sugerencia">💡 Idea para la plataforma</option>
                <option value="otro">❓ Otro motivo</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm text-white/60 block font-medium">Detalle del error *</label>
                <span className="text-[10px] text-white/40">{form.descripcion.length} / 1500</span>
              </div>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                required
                maxLength={1500}
                rows={5}
                placeholder="Describí lo más detallado posible el problema que encontraste..."
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-all resize-none placeholder:text-white/20 leading-relaxed"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                to="/"
                className="flex-1 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 py-3 rounded-xl font-bold transition-all text-center text-sm no-underline flex items-center justify-center"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={enviando}
                className="flex-[2] bg-[#B5E3D4] hover:bg-[#1CAAA8] disabled:opacity-50 text-slate-900 font-bold py-3 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {enviando ? 'Enviando...' : 'Enviar Reporte Oficial 🚀'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
