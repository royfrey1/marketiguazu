import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Home() {
  const [publicaciones, setPublicaciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: cats } = await supabase.from('categorias').select('*')
      setCategorias(cats || [])

      const { data: pubs } = await supabase
        .from('publicaciones')
        .select('*, profiles(nombre, whatsapp), categorias(nombre, icono)')
        .eq('activo', true)
        .order('created_at', { ascending: false })

      setPublicaciones(pubs || [])
      setLoading(false)
    }
    cargarDatos()
  }, [])

  // Filtrar por búsqueda y categoría
  const publicacionesFiltradas = publicaciones.filter((pub) => {
    const coincideBusqueda =
      pub.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      pub.descripcion?.toLowerCase().includes(busqueda.toLowerCase())

    const coincideCategoria = categoriaSeleccionada
      ? pub.categoria_id === categoriaSeleccionada
      : true

    return coincideBusqueda && coincideCategoria
  })

  return (
    <div className="min-h-screen bg-slate-950">

      {/* Hero */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-12 text-center">
        <h1 className="text-4xl font-black text-white mb-2">
          Iguazú <span className="text-cyan-400">Marketplace</span>
        </h1>
        <p className="text-slate-400 mb-8">Tu marketplace en las cataratas</p>

        {/* Buscador */}
        <div className="max-w-xl mx-auto relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors pr-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Filtro por categorías */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-8 scrollbar-hide">
          <button
            onClick={() => setCategoriaSeleccionada(null)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              categoriaSeleccionada === null
                ? 'bg-cyan-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Todos
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaSeleccionada(
                categoriaSeleccionada === cat.id ? null : cat.id
              )}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categoriaSeleccionada === cat.id
                  ? 'bg-cyan-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.icono} {cat.nombre}
            </button>
          ))}
        </div>

        {/* Grid de publicaciones */}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-cyan-400 animate-pulse">Cargando publicaciones...</p>
          </div>
        ) : publicacionesFiltradas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No se encontraron publicaciones</p>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="text-cyan-400 text-sm mt-2 hover:text-cyan-300"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-slate-500 text-sm mb-6">
              {publicacionesFiltradas.length} resultado{publicacionesFiltradas.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {publicacionesFiltradas.map((pub) => (
                <Link
                  key={pub.id}
                  to={`/publicacion/${pub.id}`}
                  className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl overflow-hidden transition-all group"
                >
                  {/* Imagen */}
                  <div className="h-48 bg-slate-800 overflow-hidden">
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

                  {/* Info */}
                  <div className="p-4">
                    <p className="text-xs text-slate-500 mb-1">
                      {pub.categorias?.icono} {pub.categorias?.nombre}
                    </p>
                    <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                      {pub.titulo}
                    </h3>
                    <p className="text-cyan-400 font-bold text-lg">
                      ${pub.precio?.toLocaleString('es-AR')}
                    </p>
                    <p className="text-slate-500 text-xs mt-2">
                      por {pub.profiles?.nombre}
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