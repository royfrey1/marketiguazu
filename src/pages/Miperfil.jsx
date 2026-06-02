import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faHeart, faStore, faUserGear, faSave } from '@fortawesome/free-solid-svg-icons'
import BotonFavorito from '../pages/Btnfav'

export default function MiPerfil() {
  const [usuario, setUsuario] = useState(null)
  const [favoritos, setFavoritos] = useState([])
  const [loading, setLoading] = useState(true)
  const [pestañaActiva, setPestañaActiva] = useState('datos')

  // Estados para el formulario de actualización de datos
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [direccion, setDireccion] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Estados para seccion Configuracion de Cuenta
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [passwordActual, setPasswordActual] = useState('')
  const [nuevoPassword, setNuevoPassword] = useState('')
  const [cargandoSeguridad, setCargandoSeguridad] = useState(false)

  const [passActualEmail, setPassActualEmail] = useState('')
  const [passActualPass, setPassActualPass] = useState('')

  const [emailDesbloqueado, setEmailDesbloqueado] = useState(false)
  const [passDesbloqueado, setPassDesbloqueado] = useState(false)

  const [errorEmailPass, setErrorEmailPass] = useState('')
  const [errorPassPass, setErrorPassPass] = useState('')

  const [verificandoClave, setVerificandoClave] = useState(false)

  // 🔒 NUEVOS ESTADOS: Controlan la edición individual de cada input
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [editandoWhatsapp, setEditandoWhatsapp] = useState(false)
  const [editandoDireccion, setEditandoDireccion] = useState(false)

  // Estados para el espejo de avatar
  const [subiendo, setSubiendo] = useState(false)
  const [espejoAvatar, setEspejoAvatar] = useState(false)

  useEffect(() => {
    async function cargarDatosPerfil() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setLoading(false)
          return
        }

        const { data: perfilData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (perfilData) {
          setUsuario(perfilData)
          setNombre(perfilData.nombre || '')
          setWhatsapp(perfilData.whatsapp || '')
          setDireccion(perfilData.direccion || '')
        }

        const { data: favsData } = await supabase
          .from('favoritos')
          .select(`
            id,
            publicaciones (id, titulo, precio, imagen_url, categorias(nombre, icono))
          `)
          .eq('user_id', session.user.id)

        if (favsData) {
          const lista = favsData.map(f => f.publicaciones).filter(p => p !== null)
          setFavoritos(lista)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    cargarDatosPerfil()
  }, [])

  // 💾 Actualizar textos en la Base de Datos
  const manejarActualizarDatos = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const { data: { session } } = await supabase.auth.getSession()

    const { error } = await supabase
      .from('profiles')
      .update({ nombre, whatsapp, direccion })
      .eq('id', session.user.id)

    setGuardando(false)
    if (error) {
      alert("Error al actualizar: " + error.message)
    } else {
      alert("¡Datos actualizados con éxito! 🎉")
      // Cerramos los candados tras guardar con éxito
      setEditandoNombre(false)
      setEditandoWhatsapp(false)
      setEditandoDirection(false) 
    }
  }

  const removerDeLista = (id) => {
    setFavoritos(favoritos.filter(p => p.id !== id))
  }

  // 📷 ACTUALIZADO: Sube foto al Storage Y actualiza la tabla profiles
  const subirAvatar = async (event) => {
    try {
      setSubiendo(true)
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Debes seleccionar una imagen.')
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('¡No hay un usuario logueado!')

      const fileName = `${user.id}-${Date.now()}.${fileExt}` // Agregado Date.now() para evitar problemas de caché

      // 1. Subida al bucket 'avatar'
      const { error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // 2. Traer URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatar')
        .getPublicUrl(fileName)

      // 🔥 3. PARTE FALTANTE: Guardar la URL en la fila del perfil del usuario
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      // 4. Sincronizar el estado de React en vivo
      setUsuario(prev => ({ ...prev, avatar_url: publicUrl }))
      alert('¡Foto de perfil actualizada con éxito! 📷🔥')

    } catch (error) {
      console.error(error)
      alert('Error subiendo el avatar: ' + error.message)
    } finally {
      setSubiendo(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#1b382f] text-center pt-52 font-semibold text-gray-500">Cargando panel de perfil...</div>
  if (!usuario) return <div className="min-h-screen bg-[#1b382f] text-center pt-52">Iniciá sesión para continuar.</div>

  return (
    <div className="min-h-screen bg-[#1b382f] pt-32 pb-16 px-4 md:px-8 max-w-7xl mx-auto">
      
      {/* Volver */}
      <Link
        to="/"
        className="inline-flex border-2 p-2 rounded-xl border-white/60 hover:border-[#1CAAA8] items-center text-white/80 hover:text-white text-sm m-3 transition-colors"
      >
        ← Volver al inicio
      </Link>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* 🎛️ MENU IZQUIERDO (SIDEBAR) */}
        <aside className="w-full md:w-64 bg-white rounded-3xl border border-gray-100 p-4 shadow-xs flex flex-col gap-1.5 shrink-0">
          <div className="p-4 mb-2 border-b border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Mi Cuenta</p>
            <h2 className="text-gray-800 font-extrabold text-base truncate mt-0.5">{nombre || 'Usuario'}</h2>
          </div>

          <button
            onClick={() => setPestañaActiva('datos')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer text-left w-full ${
              pestañaActiva === 'datos' 
                ? 'bg-[#1CAAA8] text-white shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <FontAwesomeIcon icon={faUser} className="w-4" />
            Mis Datos Personales
          </button>

          <button
            onClick={() => setPestañaActiva('favoritos')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer text-left w-full ${
              pestañaActiva === 'favoritos' 
                ? 'bg-[#1CAAA8] text-white shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <FontAwesomeIcon icon={faHeart} className="w-4" />
            Mis Favoritos <span className="ml-auto text-xs bg-black/10 px-2 py-0.5 rounded-full">{favoritos.length}</span>
          </button>

          <button
            onClick={() => setPestañaActiva('configuracion')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer text-left w-full ${
              pestañaActiva === 'configuracion' 
                ? 'bg-[#1CAAA8] text-white shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <FontAwesomeIcon icon={faUserGear} className="w-4" />
            Configuracion de Cuenta
          </button>

          <hr className="my-2 border-gray-100" />

          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all"
          >
            <FontAwesomeIcon icon={faStore} className="w-4 text-emerald-700" />
            {usuario.verificado ? 'Panel de Vendedor' : 'Quiero Vender 🚀'}
          </Link>
        </aside>

        {/* 🖥️ SECCIÓN DERECHA */}
        <main className="flex-1 w-full bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-sm min-h-[400px]">
          
          {pestañaActiva === 'datos' && (
            <form onSubmit={manejarActualizarDatos} className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-gray-850 text-xl font-black tracking-tight">Datos Personales</h2>
                <p className="text-gray-600 text-xs mt-0.5">Mantené tu información actualizada.</p>
              </div>

              {/* 📸 SECCIÓN AVATAR */}
              <div className="flex flex-col sm:flex-row items-center gap-5 bg-gray-50 p-4 rounded-2xl border border-gray-300">
                <div 
                  onClick={() => (usuario.avatar_url || nombre) && setEspejoAvatar(true)}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1CAAA8] to-emerald-800 flex items-center justify-center text-white font-black text-2xl uppercase shadow-md overflow-hidden cursor-zoom-in border-2 border-white shrink-0"
                >
                  {usuario.avatar_url ? (
                    <img src={usuario.avatar_url} alt={nombre} className="w-full h-full object-cover" />
                  ) : (
                    nombre ? nombre.charAt(0).toUpperCase() : '👤'
                  )}
                </div>
                
                <div className="flex flex-col gap-1 text-center sm:text-left">
                  <label className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-2xs inline-block">
                    {subiendo ? '⌛ Subiendo...' : '📷 Cambiar foto de perfil'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      disabled={subiendo}
                      onChange={subirAvatar}
                    />
                  </label>
                  <p className="text-[10px] text-gray-600">Formatos JPG o PNG. Máximo 2MB.</p>
                </div>
              </div>

              {/* Input: Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-800 uppercase">Nombre Completo</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={nombre} 
                    onChange={(e) => setNombre(e.target.value)} 
                    disabled={!editandoNombre}
                    required 
                    className={`flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-medium ${
                      editandoNombre ? 'bg-white border-[#1CAAA8] text-gray-800' : 'bg-gray-150/40 border-gray-200 text-gray-500 cursor-not-allowed'
                    }`} 
                  />
                  <button
                    type="button"
                    onClick={() => setEditandoNombre(!editandoNombre)}
                    className="p-2.5 rounded-xl border border-gray-200 font-bold text-xs bg-white hover:bg-gray-50 text-gray-500 w-10 h-10 flex items-center justify-center cursor-pointer"
                  >
                    {editandoNombre ? '🔒' : '✏️'}
                  </button>
                </div>
              </div>

              {/* Input: WhatsApp */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-800 uppercase">WhatsApp de Contacto</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={whatsapp} 
                    onChange={(e) => setWhatsapp(e.target.value)} 
                    disabled={!editandoWhatsapp}
                    placeholder="Ej: 3757123456" 
                    className={`flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-medium ${
                      editandoWhatsapp ? 'bg-white border-[#1CAAA8] text-gray-800' : 'bg-gray-150/40 border-gray-200 text-gray-500 cursor-not-allowed'
                    }`} 
                  />
                  <button
                    type="button"
                    onClick={() => setEditandoWhatsapp(!editandoWhatsapp)}
                    className="p-2.5 rounded-xl border border-gray-200 font-bold text-xs bg-white hover:bg-gray-50 text-gray-500 w-10 h-10 flex items-center justify-center cursor-pointer"
                  >
                    {editandoWhatsapp ? '🔒' : '✏️'}
                  </button>
                </div>
              </div>

              {/* Input: Dirección */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-800 uppercase">Dirección / Barrio (Puerto Iguazú)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={direccion} 
                    onChange={(e) => setDireccion(e.target.value)} 
                    disabled={!editandoDireccion}
                    placeholder="Ej: Barrio Centro, Av. Tres Fronteras" 
                    className={`flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-medium ${
                      editandoDireccion ? 'bg-white border-[#1CAAA8] text-gray-800' : 'bg-gray-150/40 border-gray-200 text-gray-500 cursor-not-allowed'
                    }`} 
                  />
                  <button
                    type="button"
                    onClick={() => setEditandoDireccion(!editandoDireccion)}
                    className="p-2.5 rounded-xl border border-gray-200 font-bold text-xs bg-white hover:bg-gray-50 text-gray-500 w-10 h-10 flex items-center justify-center cursor-pointer"
                  >
                    {editandoDireccion ? '🔒' : '✏️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={guardando || (!editandoNombre && !editandoWhatsapp && !editandoDireccion)}
                className="bg-[#1CAAA8] hover:bg-[#185749] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold px-6 py-3 rounded-full text-sm transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faSave} />
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          )}

          {/* CASO B: FAVORITOS */}
          {pestañaActiva === 'favoritos' && (
            <div>
              <div className="mb-6">
                <h2 className="text-gray-850 text-xl font-black tracking-tight">Mis Favoritos</h2>
                <p className="text-gray-600 text-xs mt-0.5">Productos que te interesaron.</p>
              </div>

              {favoritos.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl max-w-sm mx-auto">
                  <p className="text-gray-600 text-sm mb-3">No tenés productos favoritos.</p>
                  <Link to="/" className="text-[#1CAAA8] font-bold text-sm hover:underline">Explorar productos →</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favoritos.map((pub) => (
                    <div key={pub.id} className="relative bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xs hover:shadow-md transition-all group">
                      <div onClick={() => removerDeLista(pub.id)}>
                        <BotonFavorito publicacionId={pub.id} />
                      </div>
                      <Link to={`/publicacion/${pub.id}`}>
                        <div className="h-36 bg-gray-50 overflow-hidden">
                          {pub.imagen_url && <img src={pub.imagen_url} alt={pub.titulo} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" />}
                        </div>
                        <div className="p-3">
                          <h4 className="text-gray-800 font-bold text-xs truncate">{pub.titulo}</h4>
                          <p className="text-[#1CAAA8] font-black text-sm mt-1">${pub.precio?.toLocaleString('es-AR')}</p>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🛡️ CASO C: AJUSTES DE SEGURIDAD Y CUENTA */}
          {pestañaActiva === 'configuracion' && (
            <div className="space-y-8 max-w-xl animate-in fade-in duration-200">
              <div>
                <h2 className="text-gray-850 text-xl font-black tracking-tight">Configuración de la Cuenta</h2>
                <p className="text-gray-600 text-xs mt-0.5">Gestioná tus credenciales de acceso y preferencias.</p>
              </div>

              {/* Tarjeta de Estado de Cuenta */}
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tipo de Perfil</p>
                  <p className="text-gray-800 font-extrabold text-sm mt-0.5">
                    {usuario.verificado && usuario.es_vendedor ? '🏪 Vendedor Verificado' : '👤 Comprador Estándar'}
                  </p>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full uppercase">
                  Activo
                </span>
              </div>

              {/* FORMULARIO 1: ACTUALIZAR CORREO */}
              {/* ================= FORMULARIO 1: CAMBIAR CORREO ================= */}
              <div className="space-y-4 p-5 border border-gray-150 rounded-2xl bg-white">
                <h3 className="text-sm font-black text-gray-800">Actualizar Correo Electrónico</h3>
                
                {/* Paso 1: Clave Actual */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">1. Confirmá tu contraseña actual</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="password" 
                      placeholder="Contraseña actual" 
                      value={passActualEmail}
                      onChange={(e) => {
                        setPassActualEmail(e.target.value)
                        if(errorEmailPass) setErrorEmailPass('') // Limpia error al tipear
                      }}
                      disabled={emailDesbloqueado}
                      className={`flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-medium ${
                        emailDesbloqueado 
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 cursor-not-allowed' 
                          : 'bg-amber-50/30 border-amber-200 text-gray-800 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={verificandoClave || emailDesbloqueado || !passActualEmail}
                      onClick={async () => {
                        setVerificandoClave(true)
                        setErrorEmailPass('')
                        const { data: { user } } = await supabase.auth.getUser()
                        
                        // Intentamos un login silencioso para verificar la clave
                        const { error } = await supabase.auth.signInWithPassword({
                          email: usuario.email || user?.email,
                          password: passActualEmail
                        })

                        setVerificandoClave(false)
                        if (error) {
                          setErrorEmailPass('❌ Contraseña incorrecta')
                          setEmailDesbloqueado(false)
                        } else {
                          setEmailDesbloqueado(true)
                        }
                      }}
                      className={`px-4 h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center border ${
                        emailDesbloqueado
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                          : 'bg-gray-900 border-gray-900 text-white hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 cursor-pointer'
                      }`}
                    >
                      {verificandoClave ? '...' : emailDesbloqueado ? '✅ OK' : 'Verificar'}
                    </button>
                  </div>
                  {/* Mensaje de error dinámico al costado/abajo */}
                  {errorEmailPass && <p className="text-red-600 font-bold text-xs mt-0.5 animate-pulse">{errorEmailPass}</p>}
                </div>

                {/* Paso 2: Nuevo Email (Se habilita solo si el paso 1 dio OK) */}
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setCargandoSeguridad(true)
                    const { error } = await supabase.auth.updateUser({ email: nuevoEmail })
                    setCargandoSeguridad(false)
                    if (error) alert(error.message)
                    else {
                      alert("📬 ¡Te enviamos un correo de confirmación a tu nueva dirección!")
                      setNuevoEmail('')
                      setPassActualEmail('')
                      setEmailDesbloqueado(false)
                    }
                  }}
                  className="space-y-3 pt-2 border-t border-gray-100"
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase">2. Ingresá tu nuevo correo</label>
                    <input 
                      type="email" 
                      placeholder="ejemplo@nuevo.com" 
                      value={nuevoEmail}
                      onChange={(e) => setNuevoEmail(e.target.value)}
                      disabled={!emailDesbloqueado} // 🔒 Atado al candado
                      required
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-medium ${
                        emailDesbloqueado 
                          ? 'bg-white border-[#1CAAA8] text-gray-800' 
                          : 'bg-gray-50 text-gray-400 border-gray-150 cursor-not-allowed'
                      }`} 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={cargandoSeguridad || !emailDesbloqueado}
                    className="bg-[#1CAAA8] hover:bg-[#15807e] text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-2xs"
                  >
                    Guardar Nuevo Email
                  </button>
                </form>
              </div>


              {/* ================= FORMULARIO 2: CAMBIAR CONTRASEÑA ================= */}
              <div className="space-y-4 p-5 border border-gray-150 rounded-2xl bg-white">
                <h3 className="text-sm font-black text-gray-800">Modificar Contraseña</h3>
                
                {/* Paso 1: Clave Actual */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">1. Confirmá tu contraseña actual</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="password" 
                      placeholder="Contraseña actual" 
                      value={passActualPass}
                      onChange={(e) => {
                        setPassActualPass(e.target.value)
                        if(errorPassPass) setErrorPassPass('')
                      }}
                      disabled={passDesbloqueado}
                      className={`flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-medium ${
                        passDesbloqueado 
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 cursor-not-allowed' 
                          : 'bg-amber-50/30 border-amber-200 text-gray-800 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={verificandoClave || passDesbloqueado || !passActualPass}
                      onClick={async () => {
                        setVerificandoClave(true)
                        setErrorPassPass('')
                        const { data: { user } } = await supabase.auth.getUser()
                        
                        const { error } = await supabase.auth.signInWithPassword({
                          email: usuario.email || user?.email,
                          password: passActualPass
                        })

                        setVerificandoClave(false)
                        if (error) {
                          setErrorPassPass('❌ Contraseña incorrecta')
                          setPassDesbloqueado(false)
                        } else {
                          setPassDesbloqueado(true)
                        }
                      }}
                      className={`px-4 h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center border ${
                        passDesbloqueado
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                          : 'bg-gray-900 border-gray-900 text-white hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 cursor-pointer'
                      }`}
                    >
                      {verificandoClave ? '...' : passDesbloqueado ? '✅ OK' : 'Verificar'}
                    </button>
                  </div>
                  {errorPassPass && <p className="text-red-600 font-bold text-xs mt-0.5 animate-pulse">{errorPassPass}</p>}
                </div>

                {/* Paso 2: Nueva Clave */}
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setCargandoSeguridad(true)
                    const { error } = await supabase.auth.updateUser({ password: nuevoPassword })
                    setCargandoSeguridad(false)
                    if (error) alert(error.message)
                    else {
                      alert("🔑 ¡Contraseña modificada con éxito!")
                      setNuevoPassword('')
                      setPassActualPass('')
                      setPassDesbloqueado(false)
                    }
                  }}
                  className="space-y-3 pt-2 border-t border-gray-100"
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase">2. Generá tu nueva clave</label>
                    <input 
                      type="password" 
                      placeholder="Mínimo 6 caracteres" 
                      value={nuevoPassword}
                      onChange={(e) => setNuevoPassword(e.target.value)}
                      disabled={!passDesbloqueado} // 🔒 Atado al candado
                      required
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-medium ${
                        passDesbloqueado 
                          ? 'bg-white border-[#1CAAA8] text-gray-800' 
                          : 'bg-gray-50 text-gray-400 border-gray-150 cursor-not-allowed'
                      }`} 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={cargandoSeguridad || !passDesbloqueado}
                    className="bg-[#1CAAA8] hover:bg-[#15807e] text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-2xs"
                  >
                    Guardar Nueva Contraseña
                  </button>
                </form>
              </div>

              {/* 🛑 ZONA DE PELIGRO */}
              <div className="pt-4 border-t border-red-300">
                <div className="bg-red-100 border border-red-500 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-red-800 font-extrabold text-sm">Eliminar esta cuenta</h4>
                    <p className="text-gray-600 text-[12px] mt-0.5">Se borrarán tus publicaciones, favoritos y datos permanentemente.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (confirm("🚨 ¿Estás absolutamente seguro de que querés borrar tu cuenta? Esta acción no se puede deshacer.")) {
                        alert("Acá disparás la función para eliminar el perfil del usuario.")
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shrink-0"
                  >
                    Eliminar Cuenta
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* 🔍 MODAL DE AVATAR EN ESPEJO */}
      {espejoAvatar && (
        <div 
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setEspejoAvatar(false)}
        >
          <button className="absolute top-6 right-6 text-white text-xl bg-white/10 w-12 h-12 rounded-full hover:bg-white/20 transition-colors">✕</button>
          <div className="w-72 h-72 md:w-96 md:h-96 rounded-full overflow-hidden border-4 border-white shadow-2xl">
            {usuario.avatar_url ? (
              <img src={usuario.avatar_url} alt={nombre} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1CAAA8] to-emerald-800 flex items-center justify-center text-white text-7xl font-black uppercase">
                {nombre ? nombre.charAt(0).toUpperCase() : '👤'}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}