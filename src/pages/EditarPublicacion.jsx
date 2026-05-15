import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function EditarPublicacion() {
  const dropdownRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
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
        const closeMenu = (e) => {
          if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setMenuOpen(false)
        }
        document.addEventListener('mousedown', closeMenu)
        return () => document.removeEventListener('mousedown', closeMenu)
  }, [])


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

  const handleCancelar = () => {
      // validamos si hay cambios en el formulario (titulo, descripcion o imagen) antes de cancelar
      if (form.titulo.trim() || form.descripcion.trim() || imagen) {
        const confirmar = window.confirm("Tenés cambios sin guardar. ¿Seguro que querés salir?");
        if (confirmar) navigate('/dashboard');
      } else {
        // Si el formulario está vacío, salimos directo sin molestar
        navigate('/dashboard');
      }
    }; 


  if (loading) {
    return (
      <div className="min-h-screen bg-[#185749] flex items-center justify-center">
        <p className="text-[#B5E3D4] animate-pulse font-black uppercase tracking-[0.3em]">Cargando Edición...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b382f] px-4 md:px-6 pt-38 pb-10 py-10 max-w-6xl mx-auto text-white">
      <h1 className="text-3xl font-bold text-white tracking-tighter mb-6">Editar publicación</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 rounded-[2.5rem] p-6 md:p-10 shadow-2xl">

        {/* Imagen */}
        <div className="space-y-4">
          <label className="text-sm text-white/60 mb-2 block">Foto del producto</label>
          <div
            onClick={() => document.getElementById('input-imagen').click()}
            className="border-2 border-dashed border-white/20 hover:border-[#B5E3D4] rounded-[2rem] p-10 text-center cursor-pointer transition-all bg-white/5 group"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl group-hover:scale-110 transition-transform">📸</span>
                <p className="text-white/80 text-sm font-medium">Hacé click para cambiar la foto de tu producto</p>
                <p className="text-white/40 text-xs">PNG, JPG hasta 5MB</p>
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
          <label className="text-sm text-white/60 mb-1 block">Título</label>
          <input
            type="text"
            name="titulo"
            value={form.titulo}
            onChange={handleChange}
            required
            className="w-full bg-white/5 border border-white/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-colors"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="text-sm text-white/60 mb-1 block">Descripción</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            rows={4}
            className="w-full bg-white/5 border border-white/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-colors resize-none"
          />
        </div>

        {/* Precio */}
        <div>
          <label className="text-sm text-white/60 mb-1 block">Precio</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-sm">$</span>
            <input
              type="number"
              name="precio"
              value={form.precio}
              onChange={handleChange}
              required
              min="0"
              className="w-full bg-white/5 border border-white/30 rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-colors"
            />
          </div>
        </div>


        <div className="relative" ref={dropdownRef}>
          <label className="text-sm text-white/60 mb-1 block">Categoría</label>
          
          {/* El "Botón" que simula el select */}
          <div
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full bg-white/5 border border-white/30 rounded-xl px-4 py-3 text-white text-sm cursor-pointer flex justify-between items-center hover:border-[#B5E3D4] transition-all"
           >
            <span className={form.categoria_id ? "text-white" : "text-white/40"}>
              {form.categoria_id 
                ? categorias.find(c => String(c.id) === String(form.categoria_id))?.nombre 
                : "Seleccioná una categoría"}
            </span>
            <span className={`transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>

          {/* El Menú Desplegable (Capa de cristal) */}
          {menuOpen && (
            <ul className="absolute bottom-[calc(100%+5px)] left-0 z-[100] w-full bg-[#1b382f] border border-white/20 rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              {categorias.map((cat) => (
                <li
                  key={cat.id}
                  onClick={() => {
                    // Simulamos el evento para que tu handleChange actual funcione o seteamos directo
                    setForm({ ...form, categoria_id: cat.id });
                    setMenuOpen(false);
                  }}
                  className="px-4 py-3 text-sm text-white hover:bg-[#B5E3D4] hover:text-[#050810] cursor-pointer transition-colors flex items-center gap-3"
                >
                  <span>{cat.icono}</span>
                  <span className="font-medium">{cat.nombre}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 pt-4">
            {/* Botón de Cancelar */}
          <button
            type="button"
            onClick={handleCancelar}
            className="flex-1 bg-white/5 border border-white/20 text-white/60 hover:text-white hover:bg-red-500/10 hover:border-red-500/50 py-4 rounded-xl font-bold transition-all order-2 md:order-1 cursor-pointer"
          >
            Descartar
          </button>

            {/* Botón de guardar */}
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] bg-[#B5E3D4] hover:bg-[#1CAAA8]/80 disabled:opacity-50 text-slate-900 font-bold py-3 rounded-xl order-1 md:order-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando cambios...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}