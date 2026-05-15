import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [publicaciones, setPublicaciones] = useState([])
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()

        // Obtener perfil
        const { data: perfilData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setPerfil(perfilData)

        // Obtener publicaciones del usuario
        const { data: pubData } = await supabase
          .from('publicaciones')
          .select('*, categorias(nombre)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        setPublicaciones(pubData || [])
      } catch (error) {
        console.error('Error al cargar datos:', error.message)
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [])

  const handleEliminar = async (id) => {
    if (!confirm('¿Seguro que querés eliminar esta publicación?')) return

    const { error } = await supabase
      .from('publicaciones')
      .delete()
      .eq('id', id)

    if (!error) {
      setPublicaciones(publicaciones.filter(p => p.id !== id))
    }
  }

  const handleToggleActivo = async (id, activo) => {
    const { error } = await supabase
      .from('publicaciones')
      .update({ activo: !activo })
      .eq('id', id)

    if (!error) {
      setPublicaciones(publicaciones.map(p =>
        p.id === id ? { ...p, activo: !activo } : p
      ))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
        <p className="text-[#1CAAA8] animate-pulse">Cargando tu panel...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b382f] px-4 md:px-6 pt-38 pb-10 py-10 max-w-6xl mx-auto text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter">
            Hola, <span className="text-[#1CAAA8]">{perfil?.nombre}</span> 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {publicaciones.length} publicación{publicaciones.length !== 1 ? 'es' : ''} activa{publicaciones.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/nueva-publicacion"
          // className="bg-[#1CAAA8] hover:bg-[#189c52] text-slate-900 px-5 py-3 rounded-xl font-bold transition-colors"
          className="font-bold bg-[#1CAAA8] px-10 py-2 rounded-full text-lg font-bold hover:brightness-95 transition-all shadow-sm border-1 border-[#185749]/20 hover:bg-[#B5E3D4]/50 hover:border-emerald-900"
        >
          + Nueva publicación
        </Link>
      </div>

      {/* Lista de publicaciones */}
      {publicaciones.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-400 rounded-2xl">
          <p className="text-white-300 text-lg mb-4">Todavía no tenés publicaciones activas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {publicaciones.map((pub) => (
              <div
                key={pub.id}
                className={`group relative bg-white/5 backdrop-blur-xl border-2 transition-all duration-300 rounded-[2.5rem] overflow-hidden ${
                  pub.activo ? 'border-[#B5E3D4]/20 shadow-xl' : 'border-white/5 opacity-60 grayscale-[0.5]'
                }`}
               >
                {/* Badge de Estado Flotante */}
                <div className="absolute top-4 left-4 z-10">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                    pub.activo 
                    ? 'bg-[#B5E3D4] text-[#050810] border-[#B5E3D4]' 
                    : 'bg-[#050810]/80 text-white/40 border-white/10'
                  }`}>
                    {pub.activo ? 'Activa' : 'Pausada'}
                  </span>
                </div>

                {/* Imagen con Overlay */}
                <div className="relative h-48 overflow-hidden">
                  {pub.imagen_url ? (
                    <img
                      src={pub.imagen_url}
                      alt={pub.titulo}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/20 uppercase text-[10px] font-bold">Sin foto</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050810]/80 to-transparent" />
                  
                  <p className="absolute bottom-4 left-6 text-2xl font-black text-white italic tracking-tighter">
                    ${pub.precio?.toLocaleString('es-AR')}
                  </p>
                </div>

                {/* Contenido */}
                <div className="p-6">
                  <h3 className="text-white font-black text-lg uppercase tracking-tight mb-1 truncate">{pub.titulo}</h3>
                  <p className="text-[#B5E3D4] text-[10px] font-bold uppercase tracking-widest mb-6 italic">
                    {pub.categorias?.nombre || 'General'}
                  </p>

                  {/* Acciones Organizadas */}
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/editar-publicacion/${pub.id}`}
                      className="flex items-center justify-center text-[10px] font-black uppercase tracking-widest py-3 rounded-full bg-white/10 text-white hover:bg-[#B5E3D4] hover:text-[#050810] transition-all"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleToggleActivo(pub.id, pub.activo)}
                      className="text-[10px] font-black uppercase tracking-widest py-3 rounded-full border border-white/10 text-white/60 hover:border-[#B5E3D4] hover:text-white transition-all"
                    >
                      {pub.activo ? 'Pausar' : 'Activar'}
                    </button>
                    <Link
                      to={`/publicacion/${pub.id}`}
                      className="text-[10px] font-black uppercase tracking-widest py-3 rounded-full bg-white/5 text-white/40 hover:text-white text-center"
                    >
                      Ver
                    </Link>
                    <button
                      onClick={() => handleEliminar(pub.id)}
                      className="text-[10px] font-black uppercase border border-red-400/50 tracking-widest py-3 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                    >
                      Borrar
                    </button>
                  </div>
              </div>
          </div>
          ))}
        </div>
      )}
    </div>
  )
}