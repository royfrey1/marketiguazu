import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function PerfilVendedor() {
  const { id } = useParams()
  const [perfil, setPerfil] = useState(null)
  const [publicaciones, setPublicaciones] = useState([])
  const [loading, setLoading] = useState(true)

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-cyan-400 animate-pulse">Cargando perfil...</p>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400 text-lg">Vendedor no encontrado</p>
        <Link to="/" className="text-cyan-400 hover:text-cyan-300">Volver al inicio</Link>
      </div>
    )
  }

  const whatsappLink = `https://wa.me/${perfil.whatsapp?.replace(/\D/g, '')}?text=Hola! Vi tu perfil en Iguazú Marketplace y quiero consultarte algo.`

  return (
    <div className="min-h-screen bg-[#0D3732] px-4 md:px-6 pt-38 pb-10 py-10 max-w-6xl mx-auto text-white">

      {/* Header del perfil */}
      <div className="bg-[#185749] border-2 border-[#B5E3D4]/30 px-6 py-12 rounded-2xl mb-10 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-6">
          
          {/* Avatar */}
          <div className="w-50 h-40 rounded-4xl bg-white/10 flex items-center justify-center text-white font-black text-4xl flex-shrink-0">
            {perfil.nombre?.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold text-white mb-1">{perfil.nombre}</h1>
            <p className="text-white/60 mb-4">📍 {perfil.ciudad}</p>
            <p className="text-white/40 text-sm mb-6">
              {publicaciones.length} publicación{publicaciones.length !== 1 ? 'es' : ''} activa{publicaciones.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-6 mt-6">
              {perfil.whatsapp && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold px-6 py-3 rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.222-4.032c1.504.893 3.12 1.365 4.77 1.367 5.233 0 9.49-4.258 9.493-9.492.002-2.537-.987-4.922-2.787-6.722s-4.184-2.788-6.723-2.79c-5.233 0-9.491 4.258-9.493 9.491-.002 1.741.472 3.439 1.371 4.937l-1.022 3.735 3.827-.999zm11.411-6.536c-.312-.156-1.844-.91-2.128-1.012-.283-.102-.489-.156-.694.156-.205.312-.796 1.012-.976 1.216-.18.204-.36.23-.672.074-.312-.156-1.317-.485-2.507-1.547-.927-.827-1.551-1.849-1.733-2.161-.182-.312-.019-.481.136-.636.14-.139.312-.364.469-.546.156-.182.208-.312.312-.52.104-.208.052-.39-.026-.546-.078-.156-.694-1.678-.951-2.298-.25-.6-.523-.518-.717-.528-.185-.01-.397-.012-.609-.012-.212 0-.558.079-.849.39-.291.312-1.112 1.091-1.112 2.662 0 1.571 1.144 3.09 1.302 3.3.158.21 2.25 3.435 5.452 4.819.761.329 1.355.525 1.819.672.764.243 1.459.209 2.009.127.613-.091 1.844-.754 2.103-1.443.257-.689.257-1.277.18-1.403-.078-.126-.283-.205-.594-.361z"/>
                  </svg>
                  Contactar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Publicaciones */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-xl font-bold text-white mb-6">Mas publicaciones de <span className="text-[#1CAAA8]">{perfil.nombre}</span></h2>

        {publicaciones.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#389C52] rounded-2xl">
            <p className="text-slate-400">Este vendedor no tiene publicaciones activas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicaciones.map((pub) => (
              <Link
                key={pub.id}
                to={`/publicacion/${pub.id}`}
                className="bg-white/5 border border-white/30 hover:border-[#389C52] rounded-2xl overflow-hidden transition-all group"
              >
                <div className="h-48 backdrop-blur-xl border-white/10 transition-all duration-300 rounded-2xl overflow-hidden">
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
                <div className="p-6 bg-[#185749]/80 border-t border-[#B5E3D4]/80">
                  <p className="text-xs text-white/60 mb-1">
                    {pub.categorias?.icono} {pub.categorias?.nombre}
                  </p>
                  <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">{pub.titulo}</h3>
                  <p className="text-[#389C52] font-bold text-lg">
                    ${pub.precio?.toLocaleString('es-AR')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}