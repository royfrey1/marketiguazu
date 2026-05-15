import { useState, useEffect, use, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'


export default function NuevaPublicacion() {
  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [imagen, setImagen] = useState(null)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    precio: '',
    categoria_id: '',
  })


  useEffect(() => {
    const handleClickafuera = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false) 
      }
    }

    document.addEventListener('mousedown', handleClickafuera)
    return () => document.removeEventListener('mousedown', handleClickafuera)
  }, [])

  useEffect(() => {
    // Cargar categorías
    const cargarCategorias = async () => {
      const { data } = await supabase.from('categorias').select('*')
      setCategorias(data || [])
    }
    cargarCategorias()
  }, [])

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
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      let imagen_url = null

      // Subir imagen si hay una
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

      // Crear publicación
      const { error: pubError } = await supabase
        .from('publicaciones')
        .insert({
          user_id: user.id,
          titulo: form.titulo,
          descripcion: form.descripcion,
          precio: parseFloat(form.precio),
          categoria_id: parseInt(form.categoria_id),
          imagen_url,
          activo: true,
        })

      if (pubError) throw pubError

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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


  return (
    <div className="min-h-screen bg-[#1b382f] px-4 md:px-6 pt-38 pb-10 py-10 max-w-6xl mx-auto text-white"> 
      <link rel="stylesheet" href="/dashboard.jsx" />
      <h1 className="text-3xl font-bold text-white tracking-tighter mb-6">Nueva publicación</h1>
      <p className="text-[#B5E3D4] text-sm font-bold uppercase tracking-[0.2em] mb-10">Cargá los detalles de tu producto</p>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl">

        {/* Contenedor de Imagen */}
        <div className="space-y-4">
          <label className="text-sm text-white/60 mb-2 block">Foto del producto</label>
          
          {!preview ? (
            /* ESTADO 1: cargar imagen */
            <div
              onClick={() => document.getElementById('input-imagen').click()}
              className="border-2 border-dashed border-white/20 hover:border-[#B5E3D4] rounded-[2rem] p-10 text-center cursor-pointer transition-all bg-white/5 group"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl group-hover:scale-110 transition-transform">📸</span>
                <p className="text-white/80 text-sm font-medium">Hacé click para subir una foto</p>
                <p className="text-white/40 text-xs">PNG, JPG hasta 5MB</p>
              </div>
            </div>
          ) : (
            /* ESTADO 2: si hay imagen mostramos preview y boton de cambiar imagen */
            <div className="relative group">
              <div className="relative rounded-[2rem] overflow-hidden border-2 border-[#B5E3D4]/30 shadow-2xl">
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="w-full max-h-72 object-cover" 
                />
                {/* Overlay sutil al hacer hover sobre la foto */}
                <div 
                  onClick={() => document.getElementById('input-imagen').click()}
                  className="absolute inset-0 bg-[#050810]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <span className="bg-white text-[#050810] px-4 py-2 rounded-full text-xs font-black uppercase">Cambiar Foto</span>
                </div>
              </div>

              {/* Botón de acción rápida debajo de la preview */}
              <button
                type="button"
                onClick={() => document.getElementById('input-imagen').click()}
                className="mt-3 flex items-center gap-2 text-[#B5E3D4] hover:text-white text-xs font-black uppercase tracking-widest transition-colors ml-4"
              >
                <span>↻ Cambiar imagen</span>
              </button>
            </div>
          )}

          {/* Input oculto (se mantiene igual) */}
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
            placeholder="Ej: iPhone 13 Pro 128GB"
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
            className="w-full bg-white/5 border border-white/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-colors"
            placeholder="Describí tu producto — estado, características, detalles importantes..."
          />
        </div>

        {/* Precio */}
        <div>
          <label className="text-sm text-white/60 mb-1 block">Precio</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-sm"></span>
            <input
              type="number"
              name="precio"
              value={form.precio}
              onChange={handleChange}
              required
              min="0"
              className="w-full bg-white/5 border border-white/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-colors"
            />
          </div>
        </div>

        {/* Categoría */}
        {/* <div>
          <label className="text-sm text-white/60 mb-1 block">Categoría</label>
          <select
            name="categoria_id"
            value={form.categoria_id}
            onChange={handleChange}
            required
            className="w-full bg-white/5 border border-white/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1CAAA8] transition-colors"
          >
            <option value="">Seleccioná una categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icono} {cat.nombre}
              </option>
            ))}
          </select>
        </div> */}

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
            Cancelar
          </button>

            {/* Botón de Publicar */}
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] bg-[#B5E3D4] hover:bg-[#1CAAA8]/80 disabled:opacity-50 text-slate-900 font-bold py-3 rounded-xl order-1 md:order-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  )
}