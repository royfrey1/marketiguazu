import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function EditarPublicacion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [imagen, setImagen] = useState(null)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    precio: '',
    categoria_id: '',
    imagen_url: '',
  })

  useEffect(() => {
    const cargarDatos = async () => {
      // Cargar categorías
      const { data: cats } = await supabase.from('categorias').select('*')
      setCategorias(cats || [])

      // Cargar publicación actual
      const { data, error } = await supabase
        .from('publicaciones')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        navigate('/dashboard')
        return
      }

      // Verificar que la publicación es del usuario logueado
      const { data: { user } } = await supabase.auth.getUser()
      if (data.user_id !== user.id) {
        navigate('/dashboard')
        return
      }

      setForm({
        titulo: data.titulo,
        descripcion: data.descripcion || '',
        precio: data.precio,
        categoria_id: data.categoria_id,
        imagen_url: data.imagen_url || '',
      })
      setPreview(data.imagen_url)
      setLoading(false)
    }

    cargarDatos()
  }, [id, navigate])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleImagen = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImagen(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      let imagen_url = form.imagen_url

      // Subir nueva imagen si el usuario cambió la foto
      if (imagen) {
        const ext = imagen.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('publicaciones')
          .upload(fileName, imagen)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('publicaciones')
          .getPublicUrl(fileName)

        imagen_url = urlData.publicUrl
      }

      // Actualizar publicación
      const { error: updateError } = await supabase
        .from('publicaciones')
        .update({
          titulo: form.titulo,
          descripcion: form.descripcion,
          precio: parseFloat(form.precio),
          categoria_id: parseInt(form.categoria_id),
          imagen_url,
        })
        .eq('id', id)

      if (updateError) throw updateError

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-cyan-400 animate-pulse">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Editar publicación</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Imagen */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Foto del producto</label>
          <div
            onClick={() => document.getElementById('input-imagen').click()}
            className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-cover" />
            ) : (
              <div>
                <p className="text-slate-400 text-sm">Hacé click para cambiar la foto</p>
                <p className="text-slate-600 text-xs mt-1">PNG, JPG hasta 5MB</p>
              </div>
            )}
          </div>
          <input
            id="input-imagen"
            type="file"
            accept="image/*"
            onChange={handleImagen}
            className="hidden"
          />
        </div>

        {/* Título */}
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Título</label>
          <input
            type="text"
            name="titulo"
            value={form.titulo}
            onChange={handleChange}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Descripción</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors resize-none"
          />
        </div>

        {/* Precio */}
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Precio</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              name="precio"
              value={form.precio}
              onChange={handleChange}
              required
              min="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Categoría</label>
          <select
            name="categoria_id"
            value={form.categoria_id}
            onChange={handleChange}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
          >
            <option value="">Seleccioná una categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icono} {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex-1 border border-slate-700 text-slate-300 hover:border-slate-500 font-bold py-3 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-900 font-bold py-3 rounded-xl transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}