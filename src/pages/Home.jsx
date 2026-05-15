import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import bg1 from '../assets/hero/bg1.png'
import bg2 from '../assets/hero/bg2.png'
import bg3 from '../assets/hero/bg3.png'
import bg4 from '../assets/hero/bg4.png'

const heroSlides = [
  { img: bg1, titulo: 'Tus compras, en un solo lugar.', sub: 'Tecnología y estilo. Descubrí lo que buscás, hoy.' },
  { img: bg2, titulo: 'Los mejores precios de Ciudad del Este.', sub: 'Vendedores locales, productos de calidad.' },
  { img: bg3, titulo: 'Publicá y vendé en minutos.', sub: 'Creá tu perfil y llegá a miles de compradores.' },
  { img: bg4, titulo: 'Iguazú tiene su propio marketplace.', sub: 'Conectamos vendedores y compradores de la región.' },
]

export default function Home() {
  const [publicaciones, setPublicaciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
  const [slide, setSlide] = useState(0)
  const [searchParams] = useSearchParams()
  const busqueda = searchParams.get('busqueda') || ''
  const intervalRef = useRef(null)

  // Carrusel automático
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSlide(prev => (prev + 1) % heroSlides.length)
    }, 5000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const goToSlide = (i) => {
    setSlide(i)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setSlide(prev => (prev + 1) % heroSlides.length)
    }, 5000)
  }

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
    <div className="min-h-screen bg-gray-50">

      {/* Hero con carrusel */}
      <div className="relative h-[85vh] overflow-hidden">

        {/* Slides */}
        {heroSlides.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === slide ? 'opacity-100' : 'opacity-0'}`}
          >
            <img src={s.img} alt={s.titulo} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
          </div>
        ))}

        {/* Texto del slide */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pt-20">
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4 drop-shadow-lg">
            {heroSlides[slide].titulo}
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl drop-shadow">
            {heroSlides[slide].sub}
          </p>
          <Link
            to="/register"
            className="bg-accent hover:bg-primary text-white font-bold px-8 py-3.5 rounded-full transition-all duration-300 shadow-lg hover:shadow-accent/40 hover:shadow-xl"
          >
            Empezá a vender gratis
          </Link>
        </div>

        {/* Dots del carrusel */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`transition-all duration-300 rounded-full ${
                i === slide ? 'w-8 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        {/* Flechas */}
        <button
          onClick={() => goToSlide((slide - 1 + heroSlides.length) % heroSlides.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#B5E3D4]/50 backdrop-blur-sm border border-[#1CAAA8]/30 text-white flex items-center justify-center hover:bg-white/30 transition-all"
        >
          ‹
        </button>
        <button
          onClick={() => goToSlide((slide + 1) % heroSlides.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#B5E3D4]/50 backdrop-blur-sm border border-[#1CAAA8]/30 text-white flex items-center justify-center hover:bg-white/30 transition-all"
        >
          ›
        </button>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Filtros por categoría */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-8 scrollbar-hidden">
          <button
            onClick={() => setCategoriaSeleccionada(null)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${
              categoriaSeleccionada === null
                ? 'bg-primary text-[#185749] border-primary shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
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
              className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${
                categoriaSeleccionada === cat.id
                  ? 'bg-primary text-[#185749] border-primary shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
              }`}
            >
              {cat.icono} {cat.nombre}
            </button>
          ))}
        </div>

        {/* Grid de publicaciones */}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-accent animate-pulse font-semibold">Cargando publicaciones...</p>
          </div>
        ) : publicacionesFiltradas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No se encontraron publicaciones</p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6">
              {publicacionesFiltradas.length} resultado{publicacionesFiltradas.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {publicacionesFiltradas.map((pub) => (
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
                    <p className="text-gray-400 text-xs mt-1">
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