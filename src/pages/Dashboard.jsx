import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import ReCAPTCHA from "react-google-recaptcha"

export default function Dashboard() {
  const [publicaciones, setPublicaciones] = useState([])
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pasoOnboarding, setPasoOnboarding] = useState(1)

  const [nombreCompleto, setNombreCompleto] = useState('')
  const [dni, setDni] = useState('')
  const [direccion, setDireccion] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [esComercio, setEsComercio] = useState(false)

  const [captchaCompletado, setCaptchaCompletado] = useState(false)
  const onChangeCaptcha = (valor) => {
    if (valor) {
      setCaptchaCompletado(true) // Se habilita el botón
    } else {
      setCaptchaCompletado(false) // Si expira, se vuelve a bloquear
    }
  }

  useEffect(() => {
    async function chequearPerfil() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (data) {
          setPerfil(data)
          // Rellenamos el whatsapp si ya lo tenía del registro básico
          if (data.whatsapp) setWhatsapp(data.whatsapp)
          
          //  Si el usuario ya mandó la solicitud pero no está verificado, lo mandamos directo al paso 3 (Espera)
          if (data.es_vendedor && !data.verificado) {
            setPasoOnboarding(3)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    chequearPerfil()
  }, [])

  // Función para mandar los datos de postulación a Supabase
  const enviarPostulacion = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    const { error } = await supabase
      .from('profiles')
      .update({
        es_vendedor: true, // Ya es un postulante activo
        verificado: false // Aún no está verificado
      })
      .eq('id', session.user.id)

    if (error) {
      alert("Error al enviar los datos")
    } else {
      setPasoOnboarding(3) // Pasamos a la pantalla de espera
    }
  }

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()

        // Obtener perfil
        const { data: perfilData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setPerfil(perfilData)

        // Obtener publicaciones del usuario
        const { data: pubData } = await supabase
          .from('publicaciones')
          .select('*, categorias(nombre)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        setPublicaciones(pubData || [])
      } catch (error) {
        console.error('Error al cargar datos:', error.message)
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [])

  const handleEliminar = async (id) => {
    if (!confirm('¿Seguro que querés eliminar esta publicación?')) return

    const { error } = await supabase
      .from('publicaciones')
      .delete()
      .eq('id', id)

    if (!error) {
      setPublicaciones(publicaciones.filter(p => p.id !== id))
    }
  }

  const handleToggleActivo = async (id, activo) => {
    const { error } = await supabase
      .from('publicaciones')
      .update({ activo: !activo })
      .eq('id', id)

    if (!error) {
      setPublicaciones(publicaciones.map(p =>
        p.id === id ? { ...p, activo: !activo } : p
      ))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
        <p className="text-[#1CAAA8] animate-pulse">Cargando Terminos y Condiciones...</p>
      </div>
    )
  }


  if (loading) return <div className="text-center pt-32 font-semibold">Cargando panel de vendedor...</div>


  if (perfil && !perfil.verificado) {
    return (
      
      <div className="min-h-screen bg-[#B5E3D4]/50 pt-42 px-6 flex justify-center pb-12">
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl max-w-xl w-full transition-all">
          

          {/* PASO 1: TÉRMINOS Y CONDICIONES */}
          {pasoOnboarding === 1 && (
            <div>
              <span className="text-4xl block mb-2">📜</span>
              <h2 className="text-gray-850 text-2xl font-black mb-4 uppercase tracking-tight">Términos para Vendedores</h2>
              <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 h-60 overflow-y-auto mb-6 border border-gray-100 leading-relaxed">
                <p className="font-bold mb-2">Bienvenido a Iguazú Marketplace.</p>
                <p className="mb-4">Para mantener la comunidad segura y libre de estafas en la región, aceptas cumplir las siguientes normas:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>No se permite la publicación de artículos robados.</li>
                  <li>Es obligatorio proporcionar datos de contacto reales (Nombre, DNI y WhatsApp).</li>
                  <li>Las estafas o intentos de fraude serán denunciados ante las autoridades competentes y resultarás expulsado permanentemente de la plataforma.</li>
                  <li>Te comprometés a pausar o borrar las publicaciones una vez que el producto haya sido vendido.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setPasoOnboarding(2)}
                  className="w-full bg-[#1CAAA8] hover:bg-[#185749] text-white font-bold py-3.5 rounded-full transition-all cursor-pointer"
                >
                  Acepto los términos y condiciones.
                </button>
                <Link to="/" className="w-full text-center text-gray-400 hover:text-gray-600 text-md font-semibold py-2 transition-all">
                  Volver al inicio
                </Link> 
              </div>
            </div>
          )}

          {/* PASO 2: FORMULARIO DE CARGA DE DATOS */}
          {pasoOnboarding === 2 && (
            <div className="space-y-4">
              <div>
                <span className="text-4xl block mb-2">📝</span>
                <h2 className="text-gray-850 text-2xl font-black mb-1">Datos de Verificación</h2>
                <div className="bg-[#185749]/70 border border-black/50 rounded-xl p-4 text-sm text-white/90 leading-relaxed shadow-xl">
                  ℹ️ Se enviará tu postulación utilizando los datos actuales de tu cuenta. 
                  Si querés modificarlos antes de enviar, podés hacerlo desde tu{' '}
                  <Link to="/perfil" className="text-[#B5E3D4] underline font-bold">
                    Perfil Personal
                  </Link>.</div>
              </div>


              {/* 🛡️ RECAPTCHA DE GOOGLE */}
              <div className="flex justify-center py-4">
                <ReCAPTCHA
                  sitekey="6LdQvfcsAAAAADHOCDSlRWDOfRd4Cve_YwdSTo05"
                  onChange={onChangeCaptcha}
                />
              </div>

              <div className="pt-4 space-y-2">
                <button 
                  onClick={enviarPostulacion}
                  disabled={!captchaCompletado} // Solo se habilita si el captcha fue completado
                  className="w-full bg-[#1CAAA8] hover:bg-[#185749] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all mt-4 cursor-pointer"
                >
                  Enviar Solicitud de Vendedor
                </button>
                <button 
                  type="button"
                  onClick={() => setPasoOnboarding(1)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-full transition-all cursor-pointer text-sm"
                >
                  ← Volver a los Términos
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: PANTALLA DE ESPERA */}
          {pasoOnboarding === 3 && (
            <div className="text-center py-6">
              <span className="text-6xl block mb-4 animate-bounce">⏳</span>
              <h2 className="text-gray-850 text-2xl font-black mb-2">Solicitud en Revisión</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                ¡Gracias por registrarte, <span className="font-bold text-gray-700">{perfil.nombre || 'vendedor'}</span>! Recibimos tus datos correctamente. Estamos validando que tu perfil sea seguro para la comunidad de Puerto Iguazú.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-medium">
                ⏱️ El proceso suele demorar menos de 24 horas. Te avisaremos o verás tu panel activado automáticamente en cuanto sea aprobado.
              </div>
              <div className="mt-6">
                <Link
                  to="/"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-full transition-all cursor-pointer"
                >
                  Volver a inicio
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-[#1b382f] px-4 md:px-6 pt-42 pb-10 py-10 max-w-6xl mx-auto text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex items-center gap-5 bg-white shadow-xs border border-white/20 rounded-2xl px-4 py-3">
          <div className="w-22 h-22 rounded-full bg-white/5 border-2 border-[#B5E3D4]/40 overflow-hidden flex-shrink-0 shadow-xl flex items-center justify-center">
            {perfil?.avatar_url ? (
              <img src={perfil.avatar_url} className="w-full h-full object-cover" alt="Perfil" />
            ) : (
              perfil?.nombre ? perfil.nombre.charAt(0).toUpperCase() : '👤'
            )}
          </div>  
          <div className="">
            <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">
              Hola, <span className="text-[#1CAAA8]">{perfil?.nombre || 'vendedor'}</span>
            </h1>
            <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Panel de control de publicaciones</p>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 flex-wrap justify-end">
            <Link
              to="/"
              className="bg-[#1CAAA8] text-white px-6 py-3 rounded-full text-sm font-black uppercase tracking-widest whitespace-nowrap hover:bg-[#B5E3D4] hover:text-[#050810] transition-all shadow-md border border-white/10 active:scale-95"
            >
              Ir al inicio
            </Link>
            <Link
              to="/nueva-publicacion"
              // className="bg-[#1CAAA8] hover:bg-[#189c52] text-slate-900 px-5 py-3 rounded-xl font-bold transition-colors"
              className="bg-[#1CAAA8] text-white px-6 py-3 rounded-full text-sm font-black uppercase tracking-widest whitespace-nowrap hover:bg-[#B5E3D4] hover:text-[#050810] transition-all shadow-md border border-white/10 active:scale-95"
            >
              + Nueva publicación
            </Link>
        </div>
      </div>

      {/* Lista de publicaciones */}
      {publicaciones.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-400 rounded-2xl">
          <p className="text-white-300 text-lg mb-4">Todavía no tenés publicaciones activas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {publicaciones.map((pub) => (
              <div
                key={pub.id}
                className={`group relative bg-white backdrop-blur-xl border-2 transition-all duration-300 rounded-[2.5rem] overflow-hidden ${
                  pub.activo ? 'border-[#B5E3D4]/20 shadow-xl' : 'border-white/5 opacity-60 grayscale-[0.5]'
                }`}
               >
                {/* Badge de Estado Flotante */}
                <div className="absolute top-4 left-4 z-10">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                    pub.activo 
                    ? 'bg-[#B5E3D4] text-[#050810] border-[#181101]' 
                    : 'bg-[#050810]/80 text-white/70 border-white/10'
                  }`}>
                    {pub.activo ? 'Publicación Activa' : 'Publicación Pausada'}
                  </span>
                </div>

                {/* Imagen con Overlay */}
                <div className="relative h-48 overflow-hidden">
                  {pub.imagen_url ? (
                    <img
                      src={pub.imagen_url}
                      alt={pub.titulo}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/20 uppercase text-[10px] font-bold">Sin foto</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050810]/80 to-transparent" />
                  
                  <p className="absolute bottom-4 left-6 text-2xl font-black text-[#1CAAA8] italic tracking-tighter">
                    ${pub.precio?.toLocaleString('es-AR')}
                  </p>
                </div>

                {/* Contenido */}
                <div className="p-6">
                  <h3 className="text-gray-800 font-black text-lg uppercase tracking-tight mb-1 truncate">{pub.titulo}</h3>
                  <p className="text-[#0D3732] text-[10px] font-bold uppercase tracking-widest mb-6 italic">
                    {pub.categorias?.nombre || 'General'}
                  </p>

                  {/* Acciones Organizadas */}
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/editar-publicacion/${pub.id}`}
                      className="flex items-center justify-center text-[10px] font-black uppercase tracking-widest py-3 rounded-full bg-white/10 border border-gray/10 text-gray-800 hover:bg-[#B5E3D4] hover:text-[#050810] transition-all"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleToggleActivo(pub.id, pub.activo)}
                      className="text-[10px] bg-[#FCE6BB] font-black uppercase tracking-widest py-3 rounded-full border border-black/60 text-gray-800 hover:border-[#9D6B07] hover:text-gray-800 transition-all hover:bg-[#F8C662] cursor-pointer"
                    >
                      {pub.activo ? 'Pausar' : 'Activar'}
                    </button>
                    <Link
                      to={`/publicacion/${pub.id}`}
                      className="text-[10px] font-black uppercase tracking-widest py-3 rounded-full bg-[#1CAAA8] text-white hover:text-[#1CAAA8] hover:bg-white hover:border hover:border-[#1CAAA8] text-center"
                    >
                      Ver
                    </Link>
                    <button
                      onClick={() => handleEliminar(pub.id)}
                      className="text-[10px] font-black uppercase border border-red-400/50 tracking-widest py-3 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                    >
                      Borrar
                    </button>
                  </div>
              </div>
          </div>
          ))}
        </div>
      )}
    </div>
  )
}