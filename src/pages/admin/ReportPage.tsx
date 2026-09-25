import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, Bug, Paintbrush, Lightbulb, HelpCircle, Send, ArrowLeft, CheckCircle2, Shield } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { reportService } from '../../services/report.service'

interface ReportForm {
  nombre: string
  email: string
  tipo_error: string
  descripcion: string
  seguridad_val: string
}

const TIPOS_ERROR = [
  { value: 'bug', label: 'Algo no funciona', icon: Bug, desc: 'Error de código / Bug' },
  { value: 'visual', label: 'Detalle visual', icon: Paintbrush, desc: 'Imágenes rotas / Desalineado' },
  { value: 'producto', label: 'Problema con un producto', icon: AlertTriangle, desc: 'Info incorrecta / Precio / Stock' },
  { value: 'sugerencia', label: 'Idea para la plataforma', icon: Lightbulb, desc: 'Sugerencia de mejora' },
  { value: 'otro', label: 'Otro motivo', icon: HelpCircle, desc: 'Otro tipo de problema' },
]

export default function ReportarProblema() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<ReportForm>({
    nombre: '',
    email: user?.email || '',
    tipo_error: 'bug',
    descripcion: '',
    seguridad_val: '',
  })

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (exito) {
      t = setTimeout(() => navigate('/'), 3500)
    }
    return () => clearTimeout(t)
  }, [exito, navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)

    if (form.seguridad_val !== '') {
      setExito(true)
      setEnviando(false)
      return
    }

    if (!user) {
      setError('Debés iniciar sesión para enviar un reporte.')
      setEnviando(false)
      return
    }

    if (form.descripcion.trim().length < 15) {
      setError('Por favor, sé un poco más específico en la descripción (mínimo 15 caracteres).')
      setEnviando(false)
      return
    }

    try {
      const { error: insertError } = await reportService.create({
        nombre: form.nombre.trim().substring(0, 100) || 'Usuario',
        email: form.email.trim().substring(0, 100) || null,
        tipo_error: form.tipo_error,
        descripcion: form.descripcion.trim(),
        user_id: user.id,
      })

      if (insertError) throw insertError

      setExito(true)
      setForm({ nombre: '', email: user?.email || '', tipo_error: 'bug', descripcion: '', seguridad_val: '' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Report submission error:', msg)
      if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy')) {
        setError('No se pudo enviar el reporte por una restricción de seguridad. Contactanos directamente a contacto@iguazumarketplace.com')
      } else {
        setError('No se pudo enviar el reporte. Si el problema persiste, escribinos a contacto@iguazumarketplace.com')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 pt-24 md:pt-32 pb-16">
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-primary-light/30 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark mb-2">
              Reportar un problema
            </h1>
            <p className="text-body text-gray-500">
              Para enviar reportes necesitás tener una cuenta activa.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600 text-sm mb-6">
              Iniciá sesión o create una cuenta para poder reportar problemas encontrados en la tienda.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/login"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors no-underline"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-3 px-6 rounded-xl text-sm transition-colors no-underline"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 pt-24 md:pt-32 pb-16">
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-secondary" />
            </div>
            <h2 className="text-h2 text-xl text-primary-dark mb-2">Reporte enviado</h2>
            <p className="text-body text-gray-500 text-sm">
              Gracias por tu aviso. Lo revisaremos pronto. Volviendo al inicio...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pt-24 md:pt-32 pb-16">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark">
                Reportar un problema
              </h1>
              <p className="text-body text-gray-500 mt-1">
                Contanos qué encontraste para que lo resolvamos lo antes posible.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl" role="alert">
              {error}
            </div>
          )}

          {/* Honeypot */}
          <div className="hidden" aria-hidden="true">
            <input
              type="text"
              name="seguridad_val"
              value={form.seguridad_val}
              onChange={handleChange}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Name + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="report-nombre" className="text-sm font-bold text-gray-700 block mb-1.5">
                Tu nombre
                <span className="font-normal text-gray-400 ml-1">(opcional)</span>
              </label>
              <input
                id="report-nombre"
                type="text"
                name="nombre"
                maxLength={70}
                value={form.nombre}
                onChange={handleChange}
                placeholder="Juan"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors placeholder:text-gray-400"
              />
            </div>
            <div>
              <label htmlFor="report-email" className="text-sm font-bold text-gray-700 block mb-1.5">
                Email asociado
              </label>
              <input
                id="report-email"
                type="email"
                disabled
                value={form.email}
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-gray-500 text-sm cursor-not-allowed select-none"
              />
            </div>
          </div>

          {/* Tipo de error */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              Tipo de problema
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TIPOS_ERROR.map((tipo) => {
                const Icon = tipo.icon
                const active = form.tipo_error === tipo.value
                return (
                  <button
                    key={tipo.value}
                    type="button"
                    onClick={() => setForm({ ...form, tipo_error: tipo.value })}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all cursor-pointer ${
                      active
                        ? 'border-primary bg-primary/5 text-primary-dark'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                    <div>
                      <div className={`font-bold ${active ? 'text-primary-dark' : 'text-gray-700'}`}>{tipo.label}</div>
                      <div className="text-xs text-gray-400">{tipo.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="report-desc" className="text-sm font-bold text-gray-700">
                Descripción del problema
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <span className={`text-xs ${form.descripcion.length > 1400 ? 'text-red-500' : 'text-gray-400'}`}>
                {form.descripcion.length} / 1500
              </span>
            </div>
            <textarea
              id="report-desc"
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              required
              minLength={15}
              maxLength={1500}
              rows={5}
              placeholder="Describe el problema lo más detallado posible..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none placeholder:text-gray-400 leading-relaxed"
            />
            {form.descripcion.length > 0 && form.descripcion.length < 15 && (
              <p className="text-xs text-red-500 mt-1">Mínimo 15 caracteres</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold py-3 px-6 rounded-xl text-sm transition-colors no-underline"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={enviando || form.descripcion.trim().length < 15}
              className="flex-[2] inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed text-sm"
            >
              {enviando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar reporte
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
