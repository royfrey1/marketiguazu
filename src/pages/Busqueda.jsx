import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Busqueda() {
  const [publicaciones, setPublicaciones] = useState([])
  const [loading, setLoading] = useState(true)

  // 1. Estados para los nuevos filtros
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [marcaSeleccionada, setMarcaSeleccionada] = useState('')
  const [ordenarPor, setOrdenarPor] = useState('recientes') // defecto

  // useSearchParams  para leer la URL 
  const [searchParams] = useSearchParams()
  const terminoBusqueda = searchParams.get('q') || ''

  useEffect(() => {
    async function cargarYFiltrarBusqueda() {
      try {
        setLoading(true)
        
        // Traer las publicaciones activas 
        const { data, error } = await supabase
          .from('publicaciones')
          .select('*, profiles(nombre, whatsapp), categorias(nombre, icono)')
          .eq('activo', true)
          .order('created_at', { ascending: false })
        
        if (error) throw error

        // Filtramos en base al término de búsqueda
        const filtradas = data.filter((pub) => {
          const termino = terminoBusqueda.toLowerCase()
          return (
            pub.titulo.toLowerCase().includes(termino) ||
            pub.descripcion?.toLowerCase().includes(termino)
          )
        })

        setPublicaciones(filtradas)
      } catch (error) {
        console.error("Error al buscar publicaciones:", error.message)
      } finally {
        setLoading(false)
      }
    }

    cargarYFiltrarBusqueda()
  }, [terminoBusqueda]) // Se ejecuta cada vez que el usuario busca otra cosa

  // 2. Extraer marcas únicas de las publicaciones encontradas para armar el filtro dinámico
  // (Asumiendo que tenés una columna 'marca' en tu tabla, si no, se puede omitir o usar otra propiedad)
  const marcasUnicas = [...new Set(publicaciones.map(pub => pub.marca).filter(Boolean))]

  // 3. PROCESAMIENTO DE FILTROS Y ORDENAMIENTO (En tiempo real)
  console.log("Valores de los inputs actualmente -> Min:", precioMin, "Max:", precioMax);
  console.log("Lista original de publicaciones cargadas:", publicaciones);
  const publicacionesFiltradasYOrdenadas = publicaciones
    .filter((pub) => {
      const precioProducto = Number(pub.precio) || 0
      // Filtro de precio mínimo
      if (precioMin.trim() !== '') {
        if (precioProducto < Number(precioMin)) return false
      }
      // Filtro de precio máximo
      if (precioMax.trim() !== '') {
        if (precioProducto > Number(precioMax)) return false
      }
      // Filtro de marca
      if (marcaSeleccionada && pub.marca !== marcaSeleccionada) return false
      return true
    })
    .sort((a, b) => {
      if (ordenarPor === 'menor_precio') return a.precio - b.precio
      if (ordenarPor === 'mayor_precio') return b.precio - a.precio
      if (ordenarPor === 'recientes') return new Date(b.created_at) - new Date(a.created_at)
      if (ordenarPor === 'mas_vendidos') {
        // Si tenés una columna de 'ventas' o 'visitas', ordenás por eso. 
        // Si no, usamos 'id' o 'views' de prueba:
        return (b.ventas || 0) - (a.ventas || 0)
      }
      return 0
    })


  return (
    <div className="min-h-screen bg-[#1b382f] pt-32 px-6 py-10 pb-10 md:px-6 text-white max-w-6xl mx-auto">
      <div className="max-w-7xl mx-auto">
        {/* Volver */}
      <Link
        to="/"
        className="inline-flex border-2 p-2 rounded-xl border-white/60 hover:border-[#1CAAA8] items-center text-white/80 hover:text-white text-sm m-3 transition-colors"
      >
        ← Volver al inicio
      </Link>
        
        <div className="mb-8 border-b border-gray-200 pb-5">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            Resultados de <span className="text-[#1CAAA8]">Búsqueda</span>
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Mostrando resultados para: <span className="text-[#1CAAA8] font-bold">"{terminoBusqueda}"</span>
          </p>
        </div>

        {/* 🛠️ PANEL DE FILTROS SUPERIOR */}
        <div className="bg-white/30 p-5 rounded-2xl border border-gray-100 shadow-sm mb-8 flex flex-wrap gap-6 items-end justify-between">
          
          {/* Rango de precios */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Rango de Precios</span>
            <div className="flex items-center gap-2 max-w-xs">
              <input
                type="number"
                placeholder="Mín"
                value={precioMin}
                onChange={(e) => setPrecioMin(e.target.value)}
                className="w-24 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-gray-700"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="Máx"
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value)}
                className="w-24 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-gray-700"
              />
            </div>
          </div>

          {/* Selector de Marcas (Solo aparece si hay marcas en el resultado) */}
          {marcasUnicas.length > 0 && (
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Marca</span>
              <select
                value={marcaSeleccionada}
                onChange={(e) => setMarcaSeleccionada(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary text-gray-700 cursor-pointer"
              >
                <option value="">Todas las marcas</option>
                {marcasUnicas.map(marca => (
                  <option key={marca} value={marca}>{marca}</option>
                ))}
              </select>
            </div>
          )}

          {/* Selector de Ordenamiento */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Ordenar por</span>
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary text-gray-700 cursor-pointer font-semibold"
            >
              <option value="recientes">Más recientes</option>
              <option value="menor_precio">Menor precio</option>
              <option value="mayor_precio">Mayor precio</option>
              <option value="mas_vendidos">Más vendidos / Destacados</option>
            </select>
          </div>
        </div>


        {/* Estados de carga y grilla */}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-[#1CAAA8] animate-pulse font-semibold">Buscando en Iguazú Marketplace...</p>
          </div>
        ) : publicacionesFiltradasYOrdenadas.length === 0 ? (
          
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-xl mx-auto px-6">
            <span className="text-5xl block mb-4">🔍</span>
            <h3 className="text-gray-800 text-xl font-bold">No encontramos publicaciones</h3>
            <p className="text-gray-600 text-sm mt-2">
              No hay productos que coincidan con "{terminoBusqueda}". Probá revisando la ortografía o buscando palabras clave más simples.
            </p>
            <Link to="/" className="inline-block mt-6 bg-primary text-[#185749] font-bold px-6 py-2.5 rounded-full text-sm hover:brightness-95 transition-all">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <>
            
            <p className="text-white/60 text-sm mb-6">
              Se encontraron {publicacionesFiltradasYOrdenadas.length} resultado{publicacionesFiltradasYOrdenadas.length !== 1 ? 's' : ''}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {publicacionesFiltradasYOrdenadas.map((pub) => (
                <Link
                  key={pub.id}
                  to={`/publicacion/${pub.id}`}
                  className="bg-white/5 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="h-48 bg-white/10 overflow-hidden">
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
                    <p className="text-xs text-white/60 mb-1">
                      {pub.categorias?.icono} {pub.categorias?.nombre}
                    </p>
                    <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                      {pub.titulo}
                    </h3>
                    <p className="text-[#1CAAA8] font-bold text-lg">
                      ${pub.precio?.toLocaleString('es-AR')}
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                      Vendedor {pub.profiles?.nombre}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}