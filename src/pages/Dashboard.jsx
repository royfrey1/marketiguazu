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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-cyan-400 animate-pulse">Cargando tu panel...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Hola, <span className="text-cyan-400">{perfil?.nombre}</span> 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {publicaciones.length} publicación{publicaciones.length !== 1 ? 'es' : ''} activa{publicaciones.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/nueva-publicacion"
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-5 py-3 rounded-xl font-bold transition-colors"
        >
          + Nueva publicación
        </Link>
      </div>

      {/* Lista de publicaciones */}
      {publicaciones.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
          <p className="text-slate-400 text-lg mb-4">Todavía no tenés publicaciones</p>
          <Link
            to="/nueva-publicacion"
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-6 py-3 rounded-xl font-bold transition-colors"
          >
            Crear tu primera publicación
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {publicaciones.map((pub) => (
            <div
              key={pub.id}
              className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${pub.activo ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}
            >
              {pub.imagen_url && (
                <img
                  src={pub.imagen_url}
                  alt={pub.titulo}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-white font-bold text-lg">{pub.titulo}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${pub.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                    {pub.activo ? 'Activa' : 'Pausada'}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-1">{pub.categorias?.nombre}</p>
                <p className="text-cyan-400 font-bold text-lg mb-4">
                  ${pub.precio?.toLocaleString('es-AR')}
                </p>

                {/* Acciones */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActivo(pub.id, pub.activo)}
                    className="flex-1 text-xs py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
                  >
                    {pub.activo ? 'Pausar' : 'Activar'}
                  </button>
                  <Link
                    to={`/editar-publicacion/${pub.id}`}
                    className="flex-1 text-xs py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors text-center"
                  >
                    Editar
                  </Link>
                  <Link
                    to={`/publicacion/${pub.id}`}
                    className="flex-1 text-xs py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors text-center"
                  >
                    Ver
                  </Link>
                  <button
                    onClick={() => handleEliminar(pub.id)}
                    className="flex-1 text-xs py-2 rounded-lg border border-red-500/30 text-red-400 hover:border-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Eliminar
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