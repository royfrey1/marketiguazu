import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function DetallePublicacion() {
  const { id } = useParams()
  const [publicacion, setPublicacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [espejoAbierto, setEspejoAbierto] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function cargarDetalleYUser() {
      try {
        // 🔑 2. LE PEDIMOS LA SESIÓN ACTUAL A SUPABASE
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setUser(session.user) // Guardamos el usuario si está logueado
        }

        // 📦 Tu consulta actual para traer la publicación (ejemplo):
        const { data, error } = await supabase
          .from('publicaciones')
          .select('*, categorias(nombre, icono), profiles(id, nombre, whatsapp, direccion, avatar_url)')
          .eq('id', id)
          .single()

        if (data) setPublicacion(data)
      } catch (error) {
        console.error("Error al cargar:", error)
      } finally {
        setLoading(false)
      }
    }

    cargarDetalleYUser()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
        <p className="text-[#B5E3D4] animate-pulse">Cargando...</p>
      </div>
    )
  }

  if (!publicacion) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 text-lg">Publicación no encontrada</p>
        <Link to="/" className="text-[#B5E3D4] hover:text-[#B5E3D4]/80">
          Volver al inicio
        </Link>
      </div>
    )
  }

  const whatsappLink = `https://wa.me/${publicacion.profiles?.whatsapp?.replace(/\D/g, '')}?text=Hola! Vi tu publicación "${publicacion.titulo}" en Iguazú Marketplace y me interesa.`

  return (
 
    <div className="bg-[#1b382f] max-w-7xl mx-auto pt-42 px-4 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* BLOQUE IMAGEN: PROTAGONISTA (7 COLUMNAS) */}
      <div className="lg:col-span-7">
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100 aspect-square md:aspect-auto md:h-[600px]">
          <img src={publicacion.imagen_url} className="w-full h-full object-cover" alt={publicacion.titulo} />
        </div>
      </div>

      {/* BLOQUE INFORMACIÓN: BENTO GRID (5 COLUMNAS) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        
        {/* Bloque 1: Título y Precio */}
        <div className="bg-[#B5E3D4]/50 p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <span className="text-[14px] text-white font-black uppercase tracking-widest">{publicacion.categorias?.nombre}</span>
          <h1 className="text-3xl font-black text-[#0D3732] mt-2 leading-tight">{publicacion.titulo}</h1>
          <div className="mt-6 flex items-baseline gap-3">
            <p className="text-4xl font-black text-white">${publicacion.precio?.toLocaleString('es-AR')}</p>
            {publicacion.precio_anterior && (
              <p className="text-lg text-red-800 line-through font-medium opacity-80">${publicacion.precio_anterior?.toLocaleString('es-AR')}</p>
            )}
          </div>
        </div>
        
            {user ? (
              /* 🔓 CASO 1: EL COMPRADOR INICIÓ SESIÓN (Ve al vendedor y puede ir a su perfil) */
              <Link
                to={`/vendedor/${publicacion.profiles?.id}`}
                className="block bg-[#185749]/50 border border-white/10 rounded-xl p-4 hover:border-[#B5E3D4]/50 transition-all no-underline mt-4 group"
              >
                <h3 className="text-sm font-bold text-[#B5E3D4]/80 uppercase tracking-wider mb-3">
                  Información del Vendedor ✅
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#B5E3D4] to-[#1CAAA8] flex items-center justify-center text-[#050810] font-black text-xl uppercase flex-shrink-0 shadow-inner overflow-hidden">
                    {publicacion.profiles?.avatar_url ? (
                      <img
                        src={publicacion.profiles.avatar_url}
                        alt={publicacion.profiles.nombre}
                        className="w-full h-full object-cover"  
                      />
                    ) : (
                      publicacion.profiles?.nombre ? publicacion.profiles.nombre.charAt(0).toUpperCase() : '👤'
                    )}
                  </div>
                  <div>
                    <p className="text-white font-extrabold text-base group-hover:text-[#B5E3D4] transition-colors">
                      {publicacion.profiles?.nombre || 'Vendedor Destacado'}
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">
                      📍 {publicacion.profiles?.direccion || 'Puerto Iguazú, Misiones'}
                    </p>
                  </div>
                </div>

                {/* Botón de WhatsApp real visible solo para registrados */}
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold py-3.5 rounded-xl transition-colors mt-4 text-sm"
                  onClick={(e) => e.stopPropagation()} // Evita que al hacer clic en el botón active el Link de la card entera
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.222-4.032c1.504.893 3.12 1.365 4.77 1.367 5.233 0 9.49-4.258 9.493-9.492.002-2.537-.987-4.922-2.787-6.722s-4.184-2.788-6.723-2.79c-5.233 0-9.491 4.258-9.493 9.491-.002 1.741.472 3.439 1.371 4.937l-1.022 3.735 3.827-.999zm11.411-6.536c-.312-.156-1.844-.91-2.128-1.012-.283-.102-.489-.156-.694.156-.205.312-.796 1.012-.976 1.216-.18.204-.36.23-.672.074-.312-.156-1.317-.485-2.507-1.547-.927-.827-1.551-1.849-1.733-2.161-.182-.312-.019-.481.136-.636.14-.139.312-.364.469-.546.156-.182.208-.312.312-.52.104-.208.052-.39-.026-.546-.078-.156-.694-1.678-.951-2.298-.25-.6-.523-.518-.717-.528-.185-.01-.397-.012-.609-.012-.212 0-.558.079-.849.39-.291.312-1.112 1.091-1.112 2.662 0 1.571 1.144 3.09 1.302 3.3.158.21 2.25 3.435 5.452 4.819.761.329 1.355.525 1.819.672.764.243 1.459.209 2.009.127.613-.091 1.844-.754 2.103-1.443.257-.689.257-1.277.18-1.403-.078-.126-.283-.205-.594-.361z"/>
                  </svg>
                  Contactar por WhatsApp
                </a>
              </Link>
            ) : (
              /* 🔒 CASO 2: EL COMPRADOR NO TIENE CUENTA INICIADA (Muro blindado) */
              <div className="bg-[#13463a] border border-[#B5E3D4]/30 rounded-xl p-5 text-center mt-4">
                <span className="text-2xl block mb-1">🔒</span>
                <h4 className="text-[#B5E3D4] font-black text-sm tracking-tight">
                  Información del Vendedor Oculta
                </h4>
                <p className="text-white/60 text-xs mt-1 mb-4 leading-relaxed">
                  Para ver el nombre, la ubicación del local o contactar al vendedor de Iguazú, registrate o iniciá sesión.
                </p>
                
                <div className="flex flex-col gap-2">
                  <Link 
                    to="/login" 
                    className="w-full bg-[#1CAAA8] hover:bg-[#15807e] text-white font-bold py-2.5 rounded-xl text-xs transition-all uppercase tracking-wider text-center"
                  >
                    Iniciar Sesión
                  </Link>
                  <Link 
                    to="/register" 
                    className="w-full bg-transparent hover:bg-white/5 text-white/80 border border-white/20 font-bold py-2 rounded-xl text-xs transition-all text-center"
                  >
                    Crear Cuenta Gratis ✨
                  </Link>
                </div>
              </div>
            )}

        {/* Bloque 3: Descripción Detallada */}
        <div className="bg-[#B5E3D4]/50 p-8 rounded-[2rem] border border-gray-100 shadow-sm flex-1">
          <h3 className="text-sm font-black text-gray-800 uppercase mb-4 flex items-center gap-2">
            <span>📄</span> Descripción del producto
          </h3>
          <p className="text-black text-sm leading-relaxed whitespace-pre-line">
            {publicacion.descripcion || "El vendedor no proporcionó una descripción adicional."}
          </p>
        </div>

      </div>
    </div>
  )
}