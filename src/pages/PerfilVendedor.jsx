import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function PerfilVendedor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [perfil, setPerfil] = useState(null)
  const [publicaciones, setPublicaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [espejoAbierto, setEspejoAbierto] = useState(false)
  const [usuarioLogueado, setUsuarioLogueado] = useState(false)
  const [tabActiva, setTabActiva] = useState('productos')

  useEffect(() => {
      // Chequeamos si hay una sesión activa al cargar la pantalla
      const comprobarSesion = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        setUsuarioLogueado(!!session) // true si hay sesión, false si es null
      }
      comprobarSesion()
  }, [])


  useEffect(() => {
    const cargarDatos = async () => {
      const { data: perfilData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (!perfilData) return

      setPerfil(perfilData)

      const { data: pubData } = await supabase
        .from('publicaciones')
        .select('*, categorias(nombre, icono)')
        .eq('user_id', id)
        .eq('activo', true)
        .order('created_at', { ascending: false })

      setPublicaciones(pubData || [])
      setLoading(false)
    }

    cargarDatos()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
        <p className="text-[#1CAAA8] animate-pulse">Cargando perfil...</p>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex flex-col items-center justify-center gap-4">
        <p className="text-[#1CAAA8] animate-pulse">Vendedor no encontrado</p>
        <Link to="/" className="text-[#B5E3D4] hover:text-[#B5E3D4]/80">
          Volver al inicio
        </Link>
      </div>
    )
  }

  const compartirPerfil = async () => {
      const urlBase = window.location.origin; 
      const rutaPerfil = location.pathname; // Esto trae p.ej: /perfil/nombre-vendedor
      const urlFinal = `${urlBase}${rutaPerfil}`;

      const shareData = {
        title: `Perfil de ${perfil.nombre} - Iguazú Marketplace`,
        text: `Mirá todos los productos de ${perfil.nombre} en Iguazú Marketplace.`,
        url: urlFinal,
      }

      try {
        if (navigator.share) {
          // Si el navegador soporta compartir (celulares)
          await navigator.share(shareData)
        } else {
          // Si es PC, copiamos al portapapeles
          await navigator.clipboard.writeText(window.location.href)
          alert('¡Enlace copiado al portapapeles! 📋')
        }
      } catch (err) {
        console.error('Error al compartir:', err)
      }
  }

  const whatsappLink = `https://wa.me/${perfil.whatsapp?.replace(/\D/g, '')}?text=Hola! Vi tu perfil en Iguazú Marketplace y quiero consultarte algo.`

  return (
    
        <div className="min-h-screen bg-[#1b382f] pt-12">
          <div className="max-w-7xl mx-auto px-4 py-8 pt-18">

              {/* Volver */}
              <button
                onClick={() => navigate(-1)}
                className="cursor-pointer inline-flex items-center gap-2 text-white border-2 border-white/20 hover:border-[#1CAAA8] rounded-xl p-2 text-md m-6 transition-colors"
              >
                ← Volver
              </button> 

            <div className="flex flex-col md:flex-row gap-8">

              {/* SIDEBAR */}
              <aside className="w-full md:w-80 shrink-0">

                
                <div className="bg-[#B5E3D4]/50 rounded-3xl p-6 border border-gray-100 shadow-sm sticky top-24">


                  {/* Avatar + nombre */}
                  <div className="flex flex-col items-center text-center mb-8">
                    <div
                      onClick={() => perfil.avatar_url && setEspejoAbierto(true)}
                      className={`w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-accent to-primary-light mb-4 ${perfil.avatar_url ? 'cursor-zoom-in' : ''}`}
                    >
                      {perfil.avatar_url ? (
                        <img
                          src={perfil.avatar_url}
                          alt={perfil.nombre}
                          className="w-full h-full rounded-full object-cover border-4 border-white"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full border-4 border-white bg-primary/10 flex items-center justify-center text-3xl font-black text-primary">
                          {perfil.nombre?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h1 className="text-xl font-black text-[#0D3732]">{perfil.nombre}</h1>
                    <p className="text-[#0D3732] text-sm font-medium mt-1">📍 {perfil.ciudad}</p>
                    <span className="text-[12px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-md mt-2">
                      ✅ Vendedor verificado
                    </span>
                  </div>

                  {/* Botón Compartir Perfil */}
                  <button
                    onClick={compartirPerfil}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/80 border-2 border-[#1CAAA8] text-[#1CAAA8] font-bold text-sm hover:bg-[#1CAAA8] hover:text-white transition-all group"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" viewBox="0 0 24 24" 
                      strokeWidth={2} 
                      stroke="currentColor" 
                      className="w-5 h-5 group-hover:scale-110 transition-transform"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-10.628a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5m0 10.628a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5" />
                    </svg>
                    Compartir Perfil
                  </button>

                  {/* Menú lateral */}
                  <nav className="space-y-2 mb-8">
                    {[
                      { id: 'productos', label: '📦 Productos' },
                      { id: 'calificaciones', label: '⭐ Calificaciones' },
                      { id: 'ubicacion', label: '📍 Ubicación' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTabActiva(t.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                          tabActiva === t.id
                            ? 'bg-primary/10 text-primary font-black shadow-sm'
                            : 'text-white/80 hover:bg-white/10 font-bold'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </nav>

                  {/* Stats */}
                  <div className="border-t border-gray-100 pt-6 grid grid-cols-2 gap-4 text-center mb-8">
                    <div>
                      <p className="text-lg font-black text-gray-800">{publicaciones.length}</p>
                      <p className="text-[10px] text-[#0D3732] uppercase font-bold">Publicaciones</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-800">—</p>
                      <p className="text-[10px] text-[#0D3732] uppercase font-bold">Rating</p>
                    </div>
                  </div>

                  {/* Botón WhatsApp */}
                  {usuarioLogueado ? (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-center py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.222-4.032c1.504.893 3.12 1.365 4.77 1.367 5.233 0 9.49-4.258 9.493-9.492.002-2.537-.987-4.922-2.787-6.722s-4.184-2.788-6.723-2.79c-5.233 0-9.491 4.258-9.493 9.491-.002 1.741.472 3.439 1.371 4.937l-1.022 3.735 3.827-.999zm11.411-6.536c-.312-.156-1.844-.91-2.128-1.012-.283-.102-.489-.156-.694.156-.205.312-.796 1.012-.976 1.216-.18.204-.36.23-.672.074-.312-.156-1.317-.485-2.507-1.547-.927-.827-1.551-1.849-1.733-2.161-.182-.312-.019-.481.136-.636.14-.139.312-.364.469-.546.156-.182.208-.312.312-.52.104-.208.052-.39-.026-.546-.078-.156-.694-1.678-.951-2.298-.25-.6-.523-.518-.717-.528-.185-.01-.397-.012-.609-.012-.212 0-.558.079-.849.39-.291.312-1.112 1.091-1.112 2.662 0 1.571 1.144 3.09 1.302 3.3.158.21 2.25 3.435 5.452 4.819.761.329 1.355.525 1.819.672.764.243 1.459.209 2.009.127.613-.091 1.844-.754 2.103-1.443.257-.689.257-1.277.18-1.403-.078-.126-.283-.205-.594-.361z"/>
                      </svg>
                      Contactar por WhatsApp
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        alert('🔒 Para contactar al vendedor primero tenés que iniciar sesión.')
                        navigate('/login')
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-center py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 border border-gray-200"
                    >
                      🔒 Iniciá sesión para contactar
                    </button>
                  )}
                </div>
              </aside>

              {/* CONTENIDO PRINCIPAL */}
              <main className="flex-1">

                {tabActiva === 'productos' && (
                  <>
                    <h2 className="text-2xl font-black text-white/80 mb-6">
                      Productos de <span className="text-accent">{perfil.nombre}</span>
                    </h2>

                    {publicaciones.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl">
                        <p className="text-gray-400">Este vendedor no tiene publicaciones activas</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {publicaciones.map((pub) => (
                          <Link
                            key={pub.id}
                            to={`/publicacion/${pub.id}`}
                            className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
                          >
                            <div className="h-48 bg-gray-100 overflow-hidden">
                              {pub.imagen_url ? (
                                <img
                                  src={pub.imagen_url}
                                  alt={pub.titulo}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl">
                                  {pub.categorias?.icono || '📦'}
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <p className="text-xs text-gray-400 mb-1">
                                {pub.categorias?.icono} {pub.categorias?.nombre}
                              </p>
                              <h3 className="text-gray-800 font-semibold text-sm mb-2 line-clamp-2">
                                {pub.titulo}
                              </h3>
                              <p className="text-primary font-bold text-lg">
                                ${pub.precio?.toLocaleString('es-AR')}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {tabActiva === 'calificaciones' && (
                  <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-4xl mb-4">⭐</p>
                    <p className="text-gray-400 font-semibold">Sistema de calificaciones próximamente</p>
                  </div>
                )}

                {tabActiva === 'ubicacion' && (
                  <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-4xl mb-4">📍</p>
                    <p className="text-gray-400 font-semibold">Mapa de ubicación próximamente</p>
                    <p className="text-gray-300 text-sm mt-2">{perfil.ciudad}</p>
                  </div>
                )}

              </main>
            </div>
          </div>

          {/* Modal avatar */}
          {espejoAbierto && perfil.avatar_url && (
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 cursor-zoom-out"
              onClick={() => setEspejoAbierto(false)}
            >
              <div
                className="relative w-full max-w-[400px] aspect-square bg-white p-2 rounded-[2.5rem] border-2 border-primary-light shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute -top-6 -right-5 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-accent text-white hover:bg-primary transition-all text-lg font-bold shadow-md"
                  onClick={() => setEspejoAbierto(false)}
                >
                  ✕
                </button>
                <img
                  src={perfil.avatar_url}
                  alt={perfil.nombre}
                  className="w-full h-full object-cover rounded-[2rem] select-none"
                />
              </div>
            </div>
          )}
        </div>
  )
}