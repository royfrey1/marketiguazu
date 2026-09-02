import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { productsService } from '../../services/products.service'

export default function DetallePublicacion() {
  const { id } = useParams<{ id: string }>()
  const [publicacion, setPublicacion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const [imagenActiva, setImagenActiva] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function cargarDetalleYUser() {
      try {
        const { data } = await productsService.getById(Number(id))
        if (!cancelled && data) setPublicacion(data)
      } catch (error) {
        console.error("Error al cargar:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    cargarDetalleYUser()
    return () => { cancelled = true }
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
      <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
        <p className="text-white">Publicación no encontrada</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b382f] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Link to="/" className="text-[#B5E3D4] hover:text-[#1CAAA8] text-sm mb-6 inline-block">
          ← Volver al inicio
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
              <img
                src={publicacion.imagenes?.[imagenActiva] || publicacion.imagen_url}
                alt={publicacion.titulo}
                className="w-full h-96 object-contain"
              />
            </div>
            {publicacion.imagenes && publicacion.imagenes.length > 1 && (
              <div className="flex gap-2 mt-4">
                {publicacion.imagenes.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setImagenActiva(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer ${
                      imagenActiva === i ? 'border-[#1CAAA8]' : 'border-white/20'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-black mb-2">{publicacion.titulo}</h1>
            <p className="text-[#B5E3D4] text-2xl font-bold mb-4">
              ${publicacion.precio.toLocaleString('es-AR')}
            </p>

            {publicacion.categorias && (
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                <span>{publicacion.categorias.icono}</span>
                <span>{publicacion.categorias.nombre}</span>
              </div>
            )}

            {publicacion.descripcion && (
              <p className="text-gray-300 text-sm leading-relaxed mb-6">
                {publicacion.descripcion}
              </p>
            )}

            {publicacion.profiles && (
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-2">Vendedor</p>
                <p className="font-bold">{publicacion.profiles.nombre}</p>
                <p className="text-[#B5E3D4] text-sm mt-1">{publicacion.profiles.whatsapp}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
