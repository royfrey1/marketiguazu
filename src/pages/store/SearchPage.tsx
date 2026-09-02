import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { productsService } from '../../services/products.service'

export default function Busqueda() {
  const [publicaciones, setPublicaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [marcaSeleccionada, setMarcaSeleccionada] = useState('')
  const [ordenarPor, setOrdenarPor] = useState('recientes')

  const [searchParams] = useSearchParams()
  const terminoBusqueda = searchParams.get('q') || ''

  useEffect(() => {
    let cancelled = false
    async function cargarYFiltrarBusqueda() {
      try {
        setLoading(true)
        const { data, error } = await productsService.getActivePublications()
        if (error) throw error

        const filtradas = (data || []).filter((pub) => {
          const termino = terminoBusqueda.toLowerCase()
          return (
            pub.titulo.toLowerCase().includes(termino) ||
            pub.descripcion?.toLowerCase().includes(termino)
          )
        })

        if (!cancelled) setPublicaciones(filtradas)
      } catch (error) {
        console.error('Error al buscar:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    cargarYFiltrarBusqueda()
    return () => { cancelled = true }
  }, [terminoBusqueda])

  const publicacionesFiltradas = publicaciones
    .filter((pub) => {
      if (precioMin && pub.precio < Number(precioMin)) return false
      if (precioMax && pub.precio > Number(precioMax)) return false
      if (marcaSeleccionada && pub.marca !== marcaSeleccionada) return false
      return true
    })
    .sort((a, b) => {
      if (ordenarPor === 'menor') return a.precio - b.precio
      if (ordenarPor === 'mayor') return b.precio - a.precio
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
        <p className="text-[#B5E3D4] animate-pulse">Buscando productos...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b382f] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <Link to="/" className="text-[#B5E3D4] hover:text-[#1CAAA8] text-sm mb-6 inline-block">
          ← Volver al inicio
        </Link>

        <h1 className="text-3xl font-black mb-2">
          {terminoBusqueda ? `Resultados para "${terminoBusqueda}"` : 'Todos los productos'}
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          {publicacionesFiltradas.length} productos encontrados
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <input
            type="number"
            placeholder="Precio mínimo"
            value={precioMin}
            onChange={(e) => setPrecioMin(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Precio máximo"
            value={precioMax}
            onChange={(e) => setPrecioMax(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
          />
          <select
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
          >
            <option value="recientes">Más recientes</option>
            <option value="menor">Menor precio</option>
            <option value="mayor">Mayor precio</option>
          </select>
          <input
            type="text"
            placeholder="Marca"
            value={marcaSeleccionada}
            onChange={(e) => setMarcaSeleccionada(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
          />
        </div>

        {publicacionesFiltradas.length === 0 ? (
          <p className="text-gray-400 text-center py-20">No se encontraron productos</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {publicacionesFiltradas.map((pub) => (
              <Link
                key={pub.id}
                to={`/publicacion/${pub.id}`}
                className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-[#1CAAA8] transition-all"
              >
                <img
                  src={pub.imagen_url}
                  alt={pub.titulo}
                  className="w-full h-48 object-contain bg-white/5"
                />
                <div className="p-4">
                  <h3 className="font-bold text-sm mb-1 line-clamp-2">{pub.titulo}</h3>
                  <p className="text-[#1CAAA8] font-black">${pub.precio.toLocaleString('es-AR')}</p>
                  {pub.categorias && (
                    <p className="text-gray-500 text-xs mt-2">{pub.categorias.icono} {pub.categorias.nombre}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
