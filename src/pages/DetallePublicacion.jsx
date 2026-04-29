import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function DetallePublicacion() {
  const { id } = useParams()
  const [publicacion, setPublicacion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarPublicacion = async () => {
      const { data, error } = await supabase
        .from('publicaciones')
        .select('*, profiles(id, nombre, whatsapp, ciudad), categorias(nombre, icono)')
        .eq('id', id)
        .single()

      if (!error) setPublicacion(data)
      setLoading(false)
    }
    cargarPublicacion()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-cyan-400 animate-pulse">Cargando...</p>
      </div>
    )
  }

  if (!publicacion) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400 text-lg">Publicación no encontrada</p>
        <Link to="/" className="text-cyan-400 hover:text-cyan-300">
          Volver al inicio
        </Link>
      </div>
    )
  }

  const whatsappLink = `https://wa.me/${publicacion.profiles?.whatsapp?.replace(/\D/g, '')}?text=Hola! Vi tu publicación "${publicacion.titulo}" en Iguazú Marketplace y me interesa.`

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 max-w-4xl mx-auto">

      {/* Volver */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
      >
        ← Volver al inicio
      </Link>

      <div className="grid md:grid-cols-2 gap-10">

        {/* Imagen */}
        <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
          {publicacion.imagen_url ? (
            <img
              src={publicacion.imagen_url}
              alt={publicacion.titulo}
              className="w-full h-full object-cover max-h-96"
            />
          ) : (
            <div className="w-full h-64 flex items-center justify-center text-6xl">
              {publicacion.categorias?.icono || '📦'}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <p className="text-sm text-slate-500 mb-2">
              {publicacion.categorias?.icono} {publicacion.categorias?.nombre}
            </p>
            <h1 className="text-3xl font-bold text-white mb-3">
              {publicacion.titulo}
            </h1>
            <p className="text-4xl font-black text-cyan-400">
              ${publicacion.precio?.toLocaleString('es-AR')}
            </p>
          </div>

          {publicacion.descripcion && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Descripción
              </h3>
              <p className="text-slate-300 leading-relaxed">
                {publicacion.descripcion}
              </p>
            </div>
          )}

          {/* Vendedor */}
          <Link
            to={`/vendedor/${publicacion.profiles?.id}`}
            className="block bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-cyan-500/50 transition-all no-underline"
          >
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Vendedor
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                {publicacion.profiles?.nombre?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">{publicacion.profiles?.nombre}</p>
                <p className="text-slate-400 text-sm">{publicacion.profiles?.ciudad}</p>
              </div>
            </div>
          </Link >

          {/* Botón WhatsApp */}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold py-4 rounded-xl transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.222-4.032c1.504.893 3.12 1.365 4.77 1.367 5.233 0 9.49-4.258 9.493-9.492.002-2.537-.987-4.922-2.787-6.722s-4.184-2.788-6.723-2.79c-5.233 0-9.491 4.258-9.493 9.491-.002 1.741.472 3.439 1.371 4.937l-1.022 3.735 3.827-.999zm11.411-6.536c-.312-.156-1.844-.91-2.128-1.012-.283-.102-.489-.156-.694.156-.205.312-.796 1.012-.976 1.216-.18.204-.36.23-.672.074-.312-.156-1.317-.485-2.507-1.547-.927-.827-1.551-1.849-1.733-2.161-.182-.312-.019-.481.136-.636.14-.139.312-.364.469-.546.156-.182.208-.312.312-.52.104-.208.052-.39-.026-.546-.078-.156-.694-1.678-.951-2.298-.25-.6-.523-.518-.717-.528-.185-.01-.397-.012-.609-.012-.212 0-.558.079-.849.39-.291.312-1.112 1.091-1.112 2.662 0 1.571 1.144 3.09 1.302 3.3.158.21 2.25 3.435 5.452 4.819.761.329 1.355.525 1.819.672.764.243 1.459.209 2.009.127.613-.091 1.844-.754 2.103-1.443.257-.689.257-1.277.18-1.403-.078-.126-.283-.205-.594-.361z"/>
            </svg>
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}