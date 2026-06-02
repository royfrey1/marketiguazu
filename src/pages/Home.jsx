import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import bg1 from '../assets/hero/bg1.png'
import bg2 from '../assets/hero/bg2.png'
import bg3 from '../assets/hero/bg3.png'
import bg4 from '../assets/hero/bg4.png'
import Btnfav from './Btnfav'
import logo from '../assets/iguazu1.png'

const heroSlides = [
  { img: bg1, titulo: 'Tus compras, en un solo lugar.', sub: 'Tecnología y estilo. Descubrí lo que buscás, hoy.' },
  { img: bg2, titulo: 'Los mejores precios de Ciudad del Este.', sub: 'Vendedores locales, productos de calidad.' },
  { img: bg3, titulo: 'Publicá y vendé en minutos.', sub: 'Creá tu perfil y llegá a miles de compradores.' },
  { img: bg4, titulo: 'Iguazú tiene su propio marketplace.', sub: 'Conectamos vendedores y compradores de la región.' },
]

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [publicaciones, setPublicaciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
  const [slide, setSlide] = useState(0)
  const [searchParams] = useSearchParams()
  const busqueda = searchParams.get('busqueda') || ''
  const intervalRef = useRef(null)
  // Estado para productos más buscados
  const [masBuscados, setMasBuscados] = useState([])
  const [loadingBuscados, setLoadingBuscados] = useState(true)
  // Vendedores destacados (para sección adicional)
  const [vendedores, setVendedores] = useState([])
  const [loadingVendedores, setLoadingVendedores] = useState(true)
  // Estados para ofertas
  const [ofertas, setOfertas] = useState([])
  const [loadingOfertas, setLoadingOfertas] = useState(true)

  // Carrusel automático
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSlide(prev => (prev + 1) % heroSlides.length)
    }, 5000)
    return () => clearInterval(intervalRef.current)
  }, [])

    // Cargamos los más buscados 
  useEffect(() => {
    async function cargarMasBuscados() {
     try {
       setLoadingBuscados(true)
      
     // Traemos las publicaciones ordenadas por fecha descendente (las más nuevas) 
     // y limitamos la respuesta a solo 4 para la sección destacada
       const { data, error } = await supabase
        .from('publicaciones')
         .select(`
          id, 
          titulo, 
          precio, 
          imagen_url, 
          categorias(nombre, icono)
        `)
        .order('created_at', { ascending: false }) // Trae lo más nuevo primero
        .limit(4) // 🔥 Clave para que sea una sección compacta

      if (error) throw error
      if (data) setMasBuscados(data)

    } catch (error) {
      console.error("Error al cargar los productos más buscados:", error.message)
    } finally {
      setLoadingBuscados(false)
    }
  }

  cargarMasBuscados()
  }, [])

  useEffect(() => {
    async function cargarVendedoresDestacados() {
      try {
        setLoadingVendedores(true)
        // Buscamos los perfiles que ya pasaron el onboarding y fueron aprobados
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nombre, avatar_url') // Traemos el ID, el nombre comercial y su foto
          .eq('es_vendedor', true)
          .eq('verificado', true)
          .limit(10) // Traemos hasta 10 para la barra horizontal

        if (error) throw error
        if (data) setVendedores(data)
      } catch (error) {
        console.error("Error cargando vendedores destacados:", error.message)
      } finally {
        setLoadingVendedores(false)
      }
    }

    cargarVendedoresDestacados()
  }, [])

  useEffect(() => {
    async function cargarOfertas() {
      try {
        setLoadingOfertas(true)
        
        const { data, error } = await supabase
          .from('publicaciones')
          .select(`
            id, 
            titulo, 
            precio,
            precio_anterior,
            imagen_url, 
            categorias(nombre, icono)
          `)
          .eq('activo', true) // Solo productos que estén a la venta
          .order('precio', { ascending: true }) // 💸 De menor a mayor precio (¡Ofertas!)
          .limit(4) // Traemos un bloque compacto de 4

        if (error) throw error
        if (data) setOfertas(data)
      } catch (error) {
        console.error("Error cargando ofertas:", error.message)
      } finally {
        setLoadingOfertas(false)
      }
    }

    cargarOfertas()
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

  const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll)

  return (
    <div id='#home' className="min-h-screen bg-gray-50">

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
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#B5E3D4]/50 backdrop-blur-sm border border-[#1CAAA8]/30 text-white flex items-center justify-center hover:bg-white/30 transition-all cursor-pointer"
        >
          ‹
        </button>
        <button
          onClick={() => goToSlide((slide + 1) % heroSlides.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#B5E3D4]/50 backdrop-blur-sm border border-[#1CAAA8]/30 text-white flex items-center justify-center hover:bg-white/30 transition-all cursor-pointer"
        >
          ›
        </button>
      </div>

          {/* BARRA DE BENEFICIOS LOCALES */}
      <section className="bg-[#B5E3D4] border-b border-gray-200 shadow-2xs pt-6 pb-4">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Beneficio 1 */}
          <div className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#1CAAA8] text-lg font-bold group-hover:scale-105 transition-transform">
              📍
            </div>
            <div>
              <h4 className="text-gray-800 font-black text-xs md:text-sm uppercase tracking-tight">Vendedores de Iguazú y alrededores</h4>
              <p className="text-gray-600 text-[11px] font-medium mt-0.5">Comercio 100% local. Sin envíos largos ni sorpresas.</p>
            </div>
          </div>

          {/* Beneficio 2 */}
          <div className="flex items-center gap-3.5 group border-t md:border-t-0 md:border-x border-gray-100 pt-4 md:pt-0 md:px-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-lg font-bold group-hover:scale-105 transition-transform">
              💬
            </div>
            <div>
              <h4 className="text-gray-800 font-black text-xs md:text-sm uppercase tracking-tight">Trato Directo por WhatsApp</h4>
              <p className="text-gray-600 text-[11px] font-medium mt-0.5">Hacés clic, hablás con el dueño, coordinás el pago y listo.</p>
            </div>
          </div>

          {/* Beneficio 3 */}
          <div className="flex items-center gap-3.5 group border-t md:border-t-0 pt-4 md:pt-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 text-lg font-bold group-hover:scale-105 transition-transform">
              ✨
            </div>
            <div>
              <h4 className="text-gray-800 font-black text-xs md:text-sm uppercase tracking-tight">Publicá Gratis en Minutos</h4>
              <p className="text-gray-600 text-[11px] font-medium mt-0.5">¿Tenés algo para vender? Creá tu cuenta y subilo hoy mismo.</p>
            </div>
          </div>

        </div>
      </section>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-6 py-10">

          {/* SECCIÓN: TIENDAS Y VENDEDORES DESTACADOS */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-800 text-xs font-black uppercase tracking-wider">
                🏪 Vendedores y Comercios Verificados
              </h3>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                Directo de Iguazú
              </span>
            </div>

            {/* Contenedor Horizontal con Scroll */}
            <div className="flex gap-5 overflow-x-auto pb-3 pt-1 scrollbar-hidden snap-x">
              {loadingVendedores ? (
                // Esqueletos de carga redondos
                [1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex flex-col items-center gap-2 animate-pulse shrink-0">
                    <div className="w-16 h-16 rounded-full bg-gray-200" />
                    <div className="w-12 h-3 bg-gray-200 rounded-md" />
                  </div>
                ))
              ) : vendedores.length === 0 ? (
                <p className="text-gray-400 text-xs italic py-2">Pronto se sumarán más tiendas locales.</p>
              ) : (
                // Mapeo de vendedores reales
                vendedores.map((vend) => (
                  <Link
                    key={vend.id}
                    to={`/vendedor/${vend.id}`} // 👈 Esto te va a servir para cuando hagas el catálogo por vendedor
                    className="flex flex-col items-center gap-2 group shrink-0 snap-start text-center max-w-[80px]"
                  >
                    {/* Círculo del Avatar con borde degradado turquesa */}
                    <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#1CAAA8] to-[#B5E3D4] shadow-2xs group-hover:scale-105 transition-transform duration-300">
                      <div className="w-full h-full rounded-full bg-white overflow-hidden border-2 border-white flex items-center justify-center">
                        {vend.avatar_url ? (
                          <img 
                            src={vend.avatar_url} 
                            alt={vend.nombre} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          // Inicial del nombre si no tiene foto de perfil
                          <span className="text-gray-700 font-black text-sm uppercase">
                            {vend.nombre?.substring(0, 2)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Nombre de la tienda */}
                    <span className="text-gray-700 font-bold text-[11px] truncate w-full group-hover:text-[#1CAAA8] transition-colors leading-tight">
                      {vend.nombre}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* 🔥 SECCIÓN: LOS MÁS BUSCADOS */}
          <section className="bg-[#B5E3D4]/30 max-w-7xl mx-auto px-4 rounded-xl p-6 md:px-8 my-12">
            <div className=" flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] bg-[#1CAAA8]/10 text-[#1CAAA8] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  🔥 Tendencia hoy
                </span>
                <h2 className="text-gray-800 text-xl md:text-2xl font-black tracking-tight mt-1.5">
                  Los productos más buscados
                </h2>
              </div>
              <span className="text-xs text-gray-400 font-medium">Puerto Iguazú</span>
            </div>

            {/* Estado de Carga */}
            {loadingBuscados ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-gray-100 h-60 rounded-2xl"></div>
                ))}
              </div>
            ) : masBuscados.length === 0 ? (
              <p className="text-gray-400 text-xs italic">No hay productos destacados en este momento.</p>
            ) : (
              /* Grid de Productos */
              <div className="bg-[#B5E3D4]/50 rounded-xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {masBuscados.map((pub) => (
                  <Link 
                    to={`/publicacion/${pub.id}`} 
                    key={pub.id}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-2xs hover:shadow-md hover:border-gray-200 transition-all group flex flex-col"
                  >
                    {/* Contenedor Imagen */}
                    <div className="h-40 bg-gray-50 overflow-hidden relative shrink-0">
                      {pub.imagen_url ? (
                        <img 
                          src={pub.imagen_url} 
                          alt={pub.titulo} 
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-2xl">📦</div>
                      )}
                      
                      {/* Tag de categoría flotante */}
                      {pub.categorias && (
                        <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs text-[10px] font-bold text-gray-750 px-2 py-0.5 rounded-lg shadow-2xs flex items-center gap-1">
                          {pub.categorias.icono} {pub.categorias.nombre}
                        </span>
                      )}
                    </div>

                    {/* Información del Producto */}
                    <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                      <div>
                        <h3 className="text-gray-800 font-bold text-xs md:text-sm line-clamp-2 leading-tight group-hover:text-[#1CAAA8] transition-colors">
                          {pub.titulo}
                        </h3>
                      </div>
                      <div>
                        <p className="text-[#1CAAA8] font-black text-sm md:text-base">
                          ${pub.precio?.toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

        {/* 🏷️ SECCIÓN: OFERTAS IMPERDIBLES */}
          <section className="max-w-7xl mx-auto px-4 md:px-8 my-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  💰 Cuidando el bolsillo
                </span>
                <h2 className="text-gray-800 text-xl md:text-2xl font-black tracking-tight mt-1.5">
                  Ofertas imperdibles
                </h2>
              </div>
              <span className="text-xs text-gray-400 font-medium">Encontrá lo más accesible</span>
            </div>

            {/* Estado de Carga */}
            {loadingOfertas ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-gray-100 h-60 rounded-2xl"></div>
                ))}
              </div>
            ) : ofertas.length === 0 ? (
              <p className="text-gray-400 text-xs italic">No hay ofertas disponibles en este momento.</p>
            ) : (
              /* Grid de Ofertas */
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ofertas.map((pub) => (
                  <Link 
                    to={`/publicacion/${pub.id}`} 
                    key={pub.id}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-2xs hover:shadow-md hover:border-gray-200 transition-all group flex flex-col relative"
                  >
                    {/* Cartelito de Oferta Flotante */}
                    <span className="absolute top-2 right-2 z-10 bg-emerald-500 text-white font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                      Económico
                    </span>

                    {/* Contenedor Imagen */}
                    <div className="h-40 bg-gray-50 overflow-hidden relative shrink-0">
                      {pub.imagen_url ? (
                        <img 
                          src={pub.imagen_url} 
                          alt={pub.titulo} 
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-2xl">📦</div>
                      )}
                      
                      {/* Tag de categoría */}
                      {pub.categorias && (
                        <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs text-[10px] font-bold text-gray-750 px-2 py-0.5 rounded-lg shadow-2xs">
                          {pub.categorias.icono} {pub.categorias.nombre}
                        </span>
                      )}
                    </div>

                    {/* Información */}
                    <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                      <div>
                        <h3 className="text-gray-800 font-bold text-xs md:text-sm line-clamp-2 leading-tight group-hover:text-emerald-600 transition-colors">
                          {pub.titulo}
                        </h3>
                      </div>
                     {/* 💸 Bloque de Precios con Historial */}
                      <div className="flex flex-wrap items-baseline gap-2">
                        
                        {/* muestra precio anterior tachado si se cumple la condición */}
                        {pub.precio_anterior && pub.precio_anterior > pub.precio && (
                          <span className="text-red-500 font-black text-md line-through opacity-75">
                            ${pub.precio_anterior.toLocaleString('es-AR')}
                          </span>
                        )}
                        
                        {/* Precio Actual en Verde */}
                        <p className="text-emerald-600 font-black text-sm md:text-base">
                          ${pub.precio?.toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>      

            {/* Filtros por categoría */}
            <div className="border-t border-b border-gray-500 p-6 m-4 flex gap-3 overflow-x-auto pb-4 mb-8 scrollbar-hidden">
              <button
                onClick={() => setCategoriaSeleccionada(null)}
                className={`cursor-pointer whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${
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
                  className={`cursor-pointer whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${
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
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300 relative group"
                >
                  <Btnfav publicacionId={pub.id} />
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
                    <p className="text-[#1CAAA8] text-xs mt-1">
                      por {pub.profiles?.nombre}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 🌐 FOOTER */}
      <footer className="bg-gray-900 text-gray-400 mt-20 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          
          {/* Grid de Secciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            
            {/* Columna 1: Info de la Marca */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Link to="/" className="flex-shrink-0 flex items-center">
                          <img 
                            src={logo} 
                            alt="Iguazú Marketplace" 
                            className="transition-all duration-300 object-contain h-22 md:h-24" 
                          />
                </Link>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                La plataforma de comercio local que conecta a compradores y vendedores de Puerto Iguazú y ciudades cercanas de forma directa, rápida y transparente.
              </p>
            </div>

            {/* Columna 2: Enlaces de Navegación */}
            <div className="space-y-3 border-t md:border-t-0 md:border-x border-gray-800 pt-4 md:pt-0 md:px-6">
              <h4 className="pt-6 text-white font-bold text-xs uppercase tracking-wider">Navegación</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#home" className="hover:text-[#1CAAA8] transition-colors">Inicio</a>
                </li>
                <li>
                  <Link to="/register" className="hover:text-[#1CAAA8] transition-colors">Crear Cuenta</Link>
                </li>
                <li>
                  <span className="text-gray-600 cursor-not-allowed">Categorías populares</span>
                </li>
              </ul>
            </div>

            {/* Columna 3: Soporte y Legales */}
            <div className="space-y-3 border-t md:border-t-0 pt-4 md:pt-0 md:px-6 border-gray-800 md:border-l">
              <h4 className="pt-6 text-white font-bold text-xs uppercase tracking-wider">Soporte y Legales</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <span className="hover:text-[#1CAAA8] transition-colors cursor-pointer">Preguntas Frecuentes</span>
                </li>
                <li>
                  <span className="hover:text-[#1CAAA8] transition-colors cursor-pointer">Términos y Condiciones</span>
                </li>
                <li>
                  <span className="hover:text-[#1CAAA8] transition-colors cursor-pointer">Políticas de Privacidad</span>
                </li>
              </ul>
            </div>

            {/* Columna 4: Escudo de Seguridad Crítico */}
            <div className="space-y-3 bg-gray-800 p-4 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                <span>⚠️</span> Consejos de Seguridad
              </div>
              <p className="text-[11px] text-gray-300 leading-normal">
                Recordá coordinar tus entregas en lugares públicos y concurridos de la ciudad. No realices transferencias bancarias adelantadas sin verificar la identidad del vendedor.
              </p>
            </div>

          </div>

          {/* Barra Inferior de Derechos Reservados */}
          <div className="pt-8 border-t border-gray-600 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-300">
            <p>© {new Date().getFullYear()} Iguazú Marketplace. Todos los derechos reservados.</p>
            <p className="font-medium">
              Desarrollado por{' '}
              <a 
                href="https://portfolio-royf.vercel.app/"
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#389C52] hover:text-[#389C52]/50 font-black underline underline-offset-3 decoration-gray-700 hover:decoration-[#15807e] transition-all"
              >
                Roy Frey
              </a>
              {' '}en <span className="text-gray-400">Iguazu, Misiones, Argentina</span>
            </p>
          </div>

        </div>
      </footer>
    </div>
  )
}